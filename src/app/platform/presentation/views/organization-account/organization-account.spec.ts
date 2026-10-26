import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { fakeResource } from '../../../../../testing/fake-resource';
import { provideSpanish } from '../../../../../testing/provide-spanish';
import { ApiError } from '../../../../shared/domain/model/api-error';
import { LocalDate } from '../../../../shared/domain/model/local-date';
import { UsagePeriod } from '../../../../shared/domain/model/usage-period';
import { OrganizationAccountStore } from '../../../application/organization-account.store';
import { OrganizationAccountsStore } from '../../../application/organization-accounts.store';
import { OrganizationAccount } from '../../../domain/model/organization-account';
import { OrganizationUsage } from '../../../domain/model/organization-usage';
import { PlanChange } from '../../../domain/model/plan-change';
import { ChangePlanSheet } from '../change-plan-sheet/change-plan-sheet';
import { OrganizationAccountPage } from './organization-account';

const day = (text: string) => LocalDate.parse(text);
const PERIOD = UsagePeriod.of(day('2026-09-27'), day('2026-10-26'));
const LUCHO = new OrganizationAccount(
  'org-1',
  'Barbería Don Lucho',
  'standard',
  new Date('2026-11-06T05:00:00Z'),
  true,
  'luis@donlucho.pe',
  2,
);
const EXTENDED = new PlanChange(
  'pc-2',
  'max',
  'standard',
  new Date('2026-10-07T05:00:00Z'),
  new Date('2026-11-06T05:00:00Z'),
  'Yape 2026-10-06',
  'ops@takodu.pe',
  new Date('2026-10-06T20:00:00Z'),
);
const STOPPED = new PlanChange(
  'pc-1',
  'max',
  'max',
  new Date('2026-10-30T05:00:00Z'),
  new Date('2026-10-01T15:00:00Z'),
  'Pago revertido',
  'ops@takodu.pe',
  new Date('2026-10-01T15:00:00Z'),
);
const totals = (turns: number) => ({
  turns,
  inputTokens: turns * 1200,
  cachedTokens: turns * 400,
  outputTokens: turns * 90,
  toolCalls: turns * 2,
});
const USAGE = new OrganizationUsage(PERIOD, totals(12), [
  {
    establishmentId: 'est-1',
    name: 'Miraflores',
    timeZone: 'America/Lima',
    totals: totals(12),
    days: [{ date: day('2026-10-25'), totals: totals(12) }],
  },
]);

describe('OrganizationAccountPage', () => {
  let open: ReturnType<typeof vi.fn>;
  let openSheet: ReturnType<typeof vi.fn>;
  let choose: ReturnType<typeof vi.fn>;
  let account: ReturnType<typeof signal<OrganizationAccount | null | undefined>>;
  let accounts: ReturnType<typeof fakeResource<OrganizationAccount[]>>;
  let history: ReturnType<typeof fakeResource<PlanChange[]>>;
  let usage: ReturnType<typeof fakeResource<OrganizationUsage>>;

  async function render(dismissed: PlanChange | undefined = undefined) {
    open = vi.fn();
    choose = vi.fn();
    openSheet = vi.fn(() => ({ afterDismissed: () => of(dismissed) }));
    account = signal<OrganizationAccount | null | undefined>(LUCHO);
    accounts = fakeResource<OrganizationAccount[]>([LUCHO]);
    history = fakeResource<PlanChange[]>([EXTENDED, STOPPED]);
    usage = fakeResource<OrganizationUsage>(USAGE);
    TestBed.configureTestingModule({
      providers: [
        provideSpanish(),
        provideRouter([]),
        { provide: MatBottomSheet, useValue: { open: openSheet } },
        { provide: OrganizationAccountsStore, useValue: { accounts } },
        {
          provide: OrganizationAccountStore,
          useValue: { open, choose, account, history, usage, period: signal(PERIOD) },
        },
      ],
    });
    const fixture = TestBed.createComponent(OrganizationAccountPage);
    fixture.componentRef.setInput('organizationId', 'org-1');
    await fixture.whenStable();
    return { fixture, host: fixture.nativeElement as HTMLElement };
  }

  const text = (el: Element | null) => el!.textContent!.replace(/\s+/g, ' ').trim();

  it('opens the organization of the route and shows its plan in Lima', async () => {
    const { host } = await render();
    expect(open).toHaveBeenCalledWith('org-1');
    expect(text(host.querySelector('h1'))).toBe('Barbería Don Lucho');
    const plan = text(host.querySelector('[aria-labelledby="plan-title"]'));
    expect(plan).toContain('Standardcheck Activo');
    expect(plan).toContain('Activo hasta el vie, 6 nov., 00:00 (hora de Lima)');
    expect(plan).toContain('2 de 1 locales');
    expect(plan).toContain('Tiene 2 locales abiertos y su plan permite 1');
  });

  it('O5: lists the history newest first, with plan, end, stop and note', async () => {
    const { host } = await render();
    const items = [...host.querySelectorAll('.history li')].map((li) => text(li));
    expect(items[0]).toBe(
      'mar, 6 oct., 15:00 por ops@takodu.pePlan: Max → StandardFin: 7 oct. 2026 → 6 nov. 2026“Yape 2026-10-06”',
    );
    expect(items[1]).toBe('jue, 1 oct., 10:00 por ops@takodu.pePlan detenido“Pago revertido”');
  });

  it('opens the change sheet and confirms what it recorded', async () => {
    const { fixture, host } = await render(EXTENDED);
    [...host.querySelectorAll<HTMLButtonElement>('header button')]
      .find((b) => b.textContent!.includes('Registrar pago'))!
      .click();
    await fixture.whenStable();
    expect(openSheet).toHaveBeenCalledWith(
      ChangePlanSheet,
      expect.objectContaining({ data: LUCHO }),
    );
    expect(host.textContent).toContain('Cambio registrado.');
  });

  it('A9: shows usage per establishment with es-PE numbers and no money', async () => {
    const { host } = await render();
    const rows = [...host.querySelectorAll('table.numbers tr')].map((tr) =>
      [...tr.children].map((cell) => text(cell)),
    );
    expect(rows[1]).toEqual([
      'Miraflores Días con uso: 1 · America/Lima',
      '12',
      '14,400',
      '4,800',
      '1,080',
      '24',
    ]);
    expect(rows[2][0]).toBe('Total');
    expect(host.textContent).not.toContain('S/');
  });

  it('A9: refuses more than 366 days before calling pibble', async () => {
    const { fixture, host } = await render();
    const [from] = host.querySelectorAll<HTMLInputElement>('input[type="date"]');
    from.value = '2025-10-01';
    from.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    expect(host.textContent).toContain('El periodo puede tener hasta 366 días.');
    expect(choose).not.toHaveBeenCalled();

    from.value = '2026-10-01';
    from.dispatchEvent(new Event('change'));
    expect(choose).toHaveBeenCalledWith(UsagePeriod.of(day('2026-10-01'), day('2026-10-26')));
  });

  it('renders not found, loading and the offline list', async () => {
    const { fixture, host } = await render();
    account.set(null);
    await fixture.whenStable();
    expect(host.textContent).toContain('No encontramos esta organización');

    account.set(undefined);
    await fixture.whenStable();
    expect(host.querySelector('app-skeleton')).not.toBeNull();

    accounts.error.set(new ApiError(0, 'NETWORK_ERROR', ''));
    await fixture.whenStable();
    expect(host.textContent).toContain('No hay conexión');
  });

  it('shows the history and usage errors in their sections', async () => {
    const { fixture, host } = await render();
    history.error.set(new ApiError(500, 'UNEXPECTED_ERROR', ''));
    usage.error.set(new ApiError(400, 'VALIDATION_ERROR', ''));
    await fixture.whenStable();
    expect(
      host.querySelector('[aria-labelledby="history-title"] app-state-view.error'),
    ).not.toBeNull();
    expect(host.textContent).toContain('El periodo puede tener hasta 366 días.');
  });
});
