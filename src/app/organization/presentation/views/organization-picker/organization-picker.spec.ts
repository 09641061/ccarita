import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideSpanish } from '../../../../../testing/provide-spanish';
import { settle } from '../../../../../testing/settle';
import { SessionStore, SessionUser } from '../../../../iam/public-api';
import { ApiError } from '../../../../shared/domain/model/api-error';
import { CurrentOrganization } from '../../../application/current-organization.store';
import { JoinedOrganization } from '../../../domain/model/joined-organization';
import { OrganizationPicker } from './organization-picker';

const until = new Date('2026-11-06T05:00:00Z');
const donLucho = new JoinedOrganization('org-1', 'Barbería Don Lucho', until, 'm-1', 'owner');
const spa = new JoinedOrganization('org-2', 'Spa Luna', until, 'm-2', 'staff');

describe('OrganizationPicker', () => {
  async function render(load: () => Promise<readonly JoinedOrganization[]>) {
    const organizations = signal<readonly JoinedOrganization[] | null>(null);
    const selected = signal<JoinedOrganization | null>(null);
    const store = {
      organizations,
      selected,
      load: vi.fn(async () => {
        const list = await load();
        organizations.set(list);
        if (list.length === 1) selected.set(list[0]);
        return list;
      }),
      select: vi.fn(),
    };
    TestBed.configureTestingModule({
      providers: [
        provideSpanish(),
        provideRouter(
          [
            { path: 'organizaciones', component: OrganizationPicker },
            { path: '**', children: [] },
          ],
          withComponentInputBinding(),
        ),
        { provide: CurrentOrganization, useValue: store },
        {
          provide: SessionStore,
          useValue: { user: signal(new SessionUser('u-1', 'luis@donlucho.pe', null)) },
        },
      ],
    });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/organizaciones?volver=%2Fclientes');
    await settle();
    await harness.fixture.whenStable();
    return { harness, store, host: harness.routeNativeElement as HTMLElement | null };
  }

  it('lists several organizations with the role and goes back after choosing', async () => {
    const { harness, host, store } = await render(async () => [donLucho, spa]);

    const items = [...host!.querySelectorAll<HTMLButtonElement>('mat-action-list button')];
    expect(items.map((item) => item.querySelector('[matListItemTitle]')?.textContent)).toEqual([
      'Barbería Don Lucho',
      'Spa Luna',
    ]);
    expect(items[1].querySelector('[matListItemLine]')?.textContent?.trim()).toBe('Personal');
    items[1].click();
    await settle();
    await harness.fixture.whenStable();

    expect(store.select).toHaveBeenCalledWith('org-2');
    expect(TestBed.inject(Router).url).toBe('/clientes');
  });

  it('goes straight on with a single organization', async () => {
    await render(async () => [donLucho]);

    expect(TestBed.inject(Router).url).toBe('/clientes');
  });

  it('explains when the account has no business yet', async () => {
    const { host } = await render(async () => []);

    expect(host!.querySelector('app-state-view h2')?.textContent).toBe(
      'Aún no tienes un negocio en Takodu',
    );
    expect(host!.querySelector('a[href="/primeros-pasos"]')).not.toBeNull();
  });

  it('offers a retry when the list cannot load', async () => {
    const { host } = await render(async () => {
      throw new ApiError(0, 'NETWORK_ERROR', 'offline');
    });

    expect(host!.querySelector('app-state-view h2')?.textContent).toBe('No hay conexión');
  });
});
