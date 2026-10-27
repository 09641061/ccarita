import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { fakeResource } from '../../../../../testing/fake-resource';
import { provideSpanish } from '../../../../../testing/provide-spanish';
import { settle } from '../../../../../testing/settle';
import {
  AccountSessionsStore,
  PLATFORM_ENTRY,
  SessionStore,
  SessionUser,
} from '../../../../iam/public-api';
import { ApiError } from '../../../../shared/domain/model/api-error';
import { CurrentEstablishment } from '../../../application/current-establishment.store';
import { CurrentOrganization } from '../../../application/current-organization.store';
import { EstablishmentTeam } from '../../../application/establishment-team.store';
import { JoinedOrganization } from '../../../domain/model/joined-organization';
import { MemberAction, MemberRole, canPerform } from '../../../domain/model/member-role';
import { AccountSettings } from './account-settings';

const UNTIL = new Date('2026-11-06T05:00:00Z');

describe('AccountSettings', () => {
  let rename: ReturnType<typeof vi.fn>;
  let renameMe: ReturnType<typeof vi.fn>;
  const me = signal({ name: 'Luis Ramírez' });
  const selected = signal(
    new JoinedOrganization('org-1', 'Barbería Don Lucho', UNTIL, 'm-1', 'owner'),
  );

  async function render(role: MemberRole = 'owner', planActive = true) {
    selected.set(new JoinedOrganization('org-1', 'Barbería Don Lucho', UNTIL, 'm-1', role));
    // pibble answers and the memberships reload with a new object for the same organization.
    rename = vi.fn(async (name: string) => {
      selected.set(new JoinedOrganization('org-1', name, UNTIL, 'm-1', role));
    });
    me.set({ name: 'Luis Ramírez' });
    renameMe = vi.fn(async (name: string) => me.set({ name }));
    TestBed.configureTestingModule({
      providers: [
        provideSpanish(),
        provideRouter([]),
        {
          provide: SessionStore,
          useValue: { user: signal(new SessionUser('u-1', 'luis@donlucho.pe', null)) },
        },
        { provide: AccountSessionsStore, useValue: { sessions: fakeResource([]) } },
        { provide: PLATFORM_ENTRY, useValue: { visible: signal(false) } },
        {
          provide: CurrentOrganization,
          useValue: {
            can: (action: MemberAction) => canPerform(role, action),
            selected,
            organizations: signal([selected()]),
            planActive: signal(planActive),
            rename,
          },
        },
        { provide: CurrentEstablishment, useValue: { timeZone: signal('America/Lima') } },
        { provide: EstablishmentTeam, useValue: { me, renameMe } },
      ],
    });
    const fixture = TestBed.createComponent(AccountSettings);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const business = () => host.querySelector<HTMLElement>('[aria-labelledby="business-title"]')!;
    const mine = () => host.querySelector<HTMLElement>('[aria-labelledby="me-title"]')!;
    const button = (label: string, root: HTMLElement = business()) =>
      [...root.querySelectorAll<HTMLButtonElement>('button')].find((b) =>
        b.textContent!.includes(label),
      )!;
    return { fixture, host, business, mine, button };
  }

  const text = (host: Element) => host.textContent!.replace(/\s+/g, ' ');

  it('O9: tells the account the name the organization knows the user by', async () => {
    const { host } = await render('staff');
    expect(text(host.querySelector('.you')!)).toContain('Luis Ramírez');
  });

  it('O2: renames the business and keeps the saved message after the reload', async () => {
    const { fixture, host, business, button } = await render();
    const input = business().querySelector<HTMLInputElement>('form input')!;
    expect(input.value).toBe('Barbería Don Lucho');
    input.value = 'Barbería Don Pepe';
    input.dispatchEvent(new Event('input'));
    button('Guardar nombre').click();
    await settle();
    await fixture.whenStable();

    expect(rename).toHaveBeenCalledWith('Barbería Don Pepe');
    expect(text(host)).toContain('Nombre guardado.');
    expect(input.value).toBe('Barbería Don Pepe');
  });

  it('shows pibble’s error when renaming fails', async () => {
    const { fixture, business, button } = await render();
    rename.mockRejectedValue(new ApiError(402, 'PLAN_INACTIVE', ''));
    button('Guardar nombre').click();
    await settle();
    await fixture.whenStable();
    expect(business().querySelector('[role="alert"]')!.textContent).toContain('Tu plan venció');
  });

  it('O9: any member renames themself in this organization, also with an inactive plan', async () => {
    const { fixture, mine, button } = await render('staff', false);
    const input = mine().querySelector<HTMLInputElement>('input')!;
    expect(input.value).toBe('Luis Ramírez');
    expect(text(mine())).toContain('Así te ve tu equipo en Barbería Don Lucho');
    const save = button('Guardar nombre', mine());
    expect(save.disabled).toBe(false);
    input.value = 'Lucho';
    input.dispatchEvent(new Event('input'));
    save.click();
    await settle();
    await fixture.whenStable();

    expect(renameMe).toHaveBeenCalledWith('Lucho');
    expect(text(mine())).toContain('Nombre guardado.');
    expect(input.value).toBe('Lucho');
  });

  it('shows pibble’s error when renaming yourself fails', async () => {
    const { fixture, mine, button } = await render('staff');
    renameMe.mockRejectedValue(new ApiError(0, 'NETWORK_ERROR', ''));
    button('Guardar nombre', mine()).click();
    await settle();
    await fixture.whenStable();
    expect(mine().querySelector('[role="alert"]')).not.toBeNull();
  });

  it('O6: an inactive plan disables renaming', async () => {
    const { button } = await render('owner', false);
    expect(button('Guardar nombre').disabled).toBe(true);
  });

  it('03 §5: shows the business name only to the owner', async () => {
    const { host } = await render('manager');
    expect(host.querySelector('#business-title')).toBeNull();
    expect(host.querySelector('.you')).not.toBeNull();
  });
});
