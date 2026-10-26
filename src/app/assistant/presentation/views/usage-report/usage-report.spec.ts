import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { fakeResource } from '../../../../../testing/fake-resource';
import { provideSpanish } from '../../../../../testing/provide-spanish';
import { settle } from '../../../../../testing/settle';
import {
  CurrentEstablishment,
  CurrentOrganization,
  MemberAction,
  MemberRole,
} from '../../../../organization/public-api';
import { ApiError } from '../../../../shared/domain/model/api-error';
import { LocalDate } from '../../../../shared/domain/model/local-date';
import { AssistantUsage, UsageTotals } from '../../../domain/model/assistant-usage';
import { UsagePeriod } from '../../../../shared/domain/model/usage-period';
import { AssistantUsageStore } from '../../../application/assistant-usage.store';
import { UsageReport } from './usage-report';

const day = (text: string) => LocalDate.parse(text);
const PERIOD = UsagePeriod.of(day('2026-10-17'), day('2026-10-23'));
const totals = (turns: number): UsageTotals => ({
  turns,
  inputTokens: turns * 1500,
  cachedTokens: turns * 600,
  outputTokens: turns * 120,
  toolCalls: turns * 2,
});
const USAGE = new AssistantUsage(PERIOD, 'America/Lima', totals(5), [
  { date: day('2026-10-21'), totals: totals(1) },
  { date: day('2026-10-23'), totals: totals(4) },
]);

describe('UsageReport', () => {
  let store: {
    period: ReturnType<typeof signal<UsagePeriod | null>>;
    usage: ReturnType<typeof fakeResource<AssistantUsage>>;
    choose: ReturnType<typeof vi.fn>;
  };

  async function render(
    current: AssistantUsage | ApiError,
    options: { role?: MemberRole; planActive?: boolean } = {},
  ) {
    store = {
      period: signal<UsagePeriod | null>(PERIOD),
      usage: fakeResource(current instanceof AssistantUsage ? current : undefined),
      choose: vi.fn(),
    };
    if (current instanceof ApiError) store.usage.error.set(current);
    const role = options.role ?? 'owner';
    TestBed.configureTestingModule({
      providers: [
        provideSpanish(),
        { provide: AssistantUsageStore, useValue: store },
        {
          provide: CurrentOrganization,
          useValue: {
            can: (action: MemberAction) => role !== 'staff' && action === 'editSettings',
            planActive: signal(options.planActive ?? true),
          },
        },
        { provide: CurrentEstablishment, useValue: { timeZone: signal('America/Lima') } },
      ],
    });
    const fixture = TestBed.createComponent(UsageReport);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const stable = async () => {
      await settle();
      await fixture.whenStable();
    };
    return { host, stable };
  }

  const text = (host: HTMLElement) => host.textContent!.replace(/\s+/g, ' ');
  const rows = (host: HTMLElement) =>
    [...host.querySelectorAll('tr')].map((row) =>
      [...row.querySelectorAll('th, td')].map((cell) => cell.textContent!.trim()),
    );
  const setDate = (host: HTMLElement, index: number, value: string) => {
    const input = host.querySelectorAll<HTMLInputElement>('input[type="date"]')[index];
    input.value = value;
    input.dispatchEvent(new Event('change'));
  };

  it('A9: lists the days with answers, newest first, and the total of the period', async () => {
    const { host } = await render(USAGE);
    expect(rows(host)).toEqual([
      ['Día', 'Respuestas', 'Tokens de entrada', 'En caché', 'Tokens de salida', 'Herramientas'],
      ['vie, 23 oct.', '4', '6,000', '2,400', '480', '8'],
      ['mié, 21 oct.', '1', '1,500', '600', '120', '2'],
      ['Total', '5', '7,500', '3,000', '600', '10'],
    ]);
    expect(text(host)).toContain('America/Lima');
    expect(text(host)).toContain('Hasta 366 días por consulta.');
  });

  it('shows the period in the date inputs', async () => {
    const { host } = await render(USAGE);
    const inputs = host.querySelectorAll<HTMLInputElement>('input[type="date"]');
    expect([inputs[0].value, inputs[1].value]).toEqual(['2026-10-17', '2026-10-23']);
  });

  it('asks for another period when both days are valid', async () => {
    const { host, stable } = await render(USAGE);
    setDate(host, 0, '2026-10-01');
    await stable();
    expect(store.choose).toHaveBeenCalledTimes(1);
    const chosen = store.choose.mock.calls[0][0] as UsagePeriod;
    expect([chosen.from.toString(), chosen.to.toString()]).toEqual(['2026-10-01', '2026-10-23']);
  });

  it('A9: refuses more than 366 days, or the last day first, before calling pibble', async () => {
    const { host, stable } = await render(USAGE);
    setDate(host, 0, '2025-01-01');
    await stable();
    expect(text(host)).toContain('Elige como máximo 366 días.');
    setDate(host, 0, '2026-10-30');
    await stable();
    expect(text(host)).toContain('El último día no puede ser antes del primero.');
    expect(store.choose).not.toHaveBeenCalled();
  });

  it('says when nothing was answered in the period', async () => {
    const { host } = await render(new AssistantUsage(PERIOD, 'America/Lima', totals(0), []));
    expect(text(host)).toContain('Sin respuestas en estos días');
    expect(host.querySelector('table')).toBeNull();
  });

  it('A9: stays readable while the plan is inactive', async () => {
    const { host } = await render(USAGE, { planActive: false });
    expect(host.querySelector('table')).not.toBeNull();
  });

  it('03 §5: staff see no permission', async () => {
    const { host } = await render(USAGE, { role: 'staff' });
    expect(text(host)).toContain('no está disponible');
  });

  it('shows offline with retry, keeping the period', async () => {
    const { host } = await render(new ApiError(0, 'NETWORK_ERROR', ''));
    expect(text(host)).toContain('No hay conexión');
    [...host.querySelectorAll('button')]
      .find((b) => b.textContent!.includes('Reintentar'))!
      .click();
    expect(store.usage.reload).toHaveBeenCalled();
    expect(host.querySelectorAll('input[type="date"]')).toHaveLength(2);
  });
});
