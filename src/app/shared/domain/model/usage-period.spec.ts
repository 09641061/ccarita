import { LocalDate } from './local-date';
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
