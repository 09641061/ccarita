import { LocalDate } from '../../../shared/domain/model/local-date';
import { AssistantUsage } from './assistant-usage';
import { UsagePeriod } from './usage-period';

const day = (text: string) => LocalDate.parse(text);
const lima = 'America/Lima';

describe('UsagePeriod', () => {
  it('A9: accepts up to 366 days, both included', () => {
    expect(UsagePeriod.problemOf(day('2025-10-27'), day('2026-10-27'))).toBeNull();
    expect(UsagePeriod.of(day('2025-10-27'), day('2026-10-27')).days).toBe(366);
    expect(UsagePeriod.problemOf(day('2025-10-26'), day('2026-10-27'))).toBe('length');
  });

  it('refuses a last day before the first, and accepts a single day', () => {
    expect(UsagePeriod.problemOf(day('2026-10-27'), day('2026-10-26'))).toBe('order');
    expect(UsagePeriod.of(day('2026-10-27'), day('2026-10-27')).days).toBe(1);
    expect(() => UsagePeriod.of(day('2026-10-27'), day('2026-10-26'))).toThrow();
  });

  it('defaults to the last 7 days of the establishment, today included', () => {
    // 03:00 UTC on the 27th is still the 26th in Lima.
    const period = UsagePeriod.lastDays(7, new Date('2026-10-27T03:00:00Z'), lima);
    expect([period.from.toString(), period.to.toString(), period.days]).toEqual([
      '2026-10-20',
      '2026-10-26',
      7,
    ]);
  });

  it('compares by its days', () => {
    const period = UsagePeriod.of(day('2026-10-20'), day('2026-10-26'));
    expect(period.equals(UsagePeriod.of(day('2026-10-20'), day('2026-10-26')))).toBe(true);
    expect(period.equals(UsagePeriod.of(day('2026-10-21'), day('2026-10-26')))).toBe(false);
  });
});

describe('AssistantUsage', () => {
  const totals = (turns: number) => ({
    turns,
    inputTokens: turns * 100,
    cachedTokens: 0,
    outputTokens: turns * 10,
    toolCalls: turns,
  });
  const period = UsagePeriod.of(day('2026-10-20'), day('2026-10-26'));

  it('lists the days with turns newest first', () => {
    const usage = new AssistantUsage(period, lima, totals(3), [
      { date: day('2026-10-21'), totals: totals(1) },
      { date: day('2026-10-23'), totals: totals(2) },
    ]);
    expect(usage.newestFirst.map((d) => d.date.toString())).toEqual(['2026-10-23', '2026-10-21']);
    expect(usage.isEmpty).toBe(false);
  });

  it('is empty when nothing was answered', () => {
    expect(new AssistantUsage(period, lima, totals(0), []).isEmpty).toBe(true);
  });
});
