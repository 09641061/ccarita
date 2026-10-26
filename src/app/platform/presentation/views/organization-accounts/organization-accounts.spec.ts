import { BreakpointObserver } from '@angular/cdk/layout';
import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { fakeResource } from '../../../../../testing/fake-resource';
import { provideSpanish } from '../../../../../testing/provide-spanish';
import { ApiError } from '../../../../shared/domain/model/api-error';
import { OrganizationAccountsStore } from '../../../application/organization-accounts.store';
import { OrganizationAccount } from '../../../domain/model/organization-account';
import { OrganizationAccounts } from './organization-accounts';

const LUCHO = new OrganizationAccount(
  'org-1',
  'Barbería Don Lucho',
  'standard',
  new Date('2026-10-20T05:00:00Z'),
  false,
  'luis@donlucho.pe',
  2,
);
const SPA = new OrganizationAccount(
  'org-2',
  'Spa Lima',
  'max',
  new Date('2026-11-06T05:00:00Z'),
  true,
  'ana@gmail.com',
  3,
);

describe('OrganizationAccounts', () => {
  let accounts: ReturnType<typeof fakeResource<OrganizationAccount[]>>;
  let query: ReturnType<typeof signal<string>>;

  async function render({ desktop = true, list = [LUCHO, SPA] } = {}) {
    accounts = fakeResource<OrganizationAccount[]>(list);
    query = signal('');
    TestBed.configureTestingModule({
      providers: [
        provideSpanish(),
        provideRouter([]),
        {
          provide: BreakpointObserver,
          useValue: { observe: () => of({ matches: desktop, breakpoints: {} }) },
        },
        {
          provide: OrganizationAccountsStore,
          useValue: {
            accounts,
            query,
            visible: computed(() => accounts.value()!.filter((a) => a.matches(query()))),
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(OrganizationAccounts);
    await fixture.whenStable();
    return { fixture, host: fixture.nativeElement as HTMLElement };
  }

  const text = (el: Element | null) => el!.textContent!.replace(/\s+/g, ' ').trim();

  it('O4, O5: lists plan, status in Lima and establishments against the limit', async () => {
    const { host } = await render();
    const rows = [...host.querySelectorAll('tbody tr')].map((row) =>
      [...row.querySelectorAll('td')].map((td) => text(td)),
    );
    expect(rows).toEqual([
      [
        'Barbería Don Lucholuis@donlucho.pe',
        'Standard',
        'error Vencido venció el 20 oct. 2026',
        '2 de 1 locales warning Sobre el límite',
      ],
      [
        'Spa Limaana@gmail.com',
        'Max',
        'check Activo vence el 6 nov. 2026',
        '3 locales, sin límite',
      ],
    ]);
    expect(host.querySelector('tbody a')!.getAttribute('href')).toBe('/org-1');
  });

  it('searches by name or owner email', async () => {
    const { fixture, host } = await render();
    const input = host.querySelector<HTMLInputElement>('input[type="search"]')!;
    input.value = 'ANA@';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(query()).toBe('ANA@');
    expect(host.querySelectorAll('tbody tr')).toHaveLength(1);

    input.value = 'zzz';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(host.textContent).toContain('Nada coincide con la búsqueda');
  });

  it('shows cards on phones', async () => {
    const { host } = await render({ desktop: false });
    expect(host.querySelector('table')).toBeNull();
    expect(host.querySelectorAll('.cards li')).toHaveLength(2);
  });

  it('renders the empty, offline, forbidden and loading states', async () => {
    const { fixture, host } = await render({ list: [] });
    expect(host.textContent).toContain('Aún no hay organizaciones');

    accounts.error.set(new ApiError(0, 'NETWORK_ERROR', ''));
    await fixture.whenStable();
    expect(host.textContent).toContain('No hay conexión');
    host.querySelector<HTMLButtonElement>('app-state-view button')!.click();
    expect(accounts.reload).toHaveBeenCalled();

    accounts.error.set(new ApiError(403, 'ACCESS_DENIED', ''));
    await fixture.whenStable();
    expect(host.querySelector('app-state-view.forbidden')).not.toBeNull();

    accounts.error.set(undefined);
    accounts.isLoading.set(true);
    await fixture.whenStable();
    expect(host.querySelector('app-skeleton')).not.toBeNull();
  });
});
