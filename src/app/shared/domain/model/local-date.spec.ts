import { LocalDate, localTimeOf } from './local-date';

describe('LocalDate', () => {
  const lima = 'America/Lima';

  it('takes the day of an instant in the establishment zone, not UTC', () => {
    // 02:00 UTC on the 24th is still the 23rd in Lima (UTC-5).
    expect(LocalDate.of(new Date('2026-10-24T02:00:00Z'), lima).toString()).toBe('2026-10-23');
  });

  it('starts the day at local midnight', () => {
    expect(LocalDate.parse('2026-10-23').startIn(lima).toISOString()).toBe(
      '2026-10-23T05:00:00.000Z',
    );
  });

  it('turns a wall-clock time into an instant', () => {
    expect(LocalDate.parse('2026-10-23').atTime('09:30', lima).toISOString()).toBe(
      '2026-10-23T14:30:00.000Z',
    );
  });

  it('follows daylight saving time', () => {
    const madrid = 'Europe/Madrid';
    expect(LocalDate.parse('2026-07-01').atTime('10:00', madrid).toISOString()).toBe(
      '2026-07-01T08:00:00.000Z',
    );
    expect(LocalDate.parse('2026-12-01').atTime('10:00', madrid).toISOString()).toBe(
      '2026-12-01T09:00:00.000Z',
    );
  });

  it('counts weeks from Monday across month ends', () => {
    const friday = LocalDate.parse('2026-10-23');
    expect(friday.weekday).toBe(4);
    expect(friday.startOfWeek().toString()).toBe('2026-10-19');
    expect(friday.plusDays(10).toString()).toBe('2026-11-02');
    expect(LocalDate.parse('2026-11-01').weekday).toBe(6);
  });

  it('refuses days that do not exist', () => {
    expect(() => LocalDate.parse('2026-02-30')).toThrow();
    expect(() => LocalDate.parse('23/10/2026')).toThrow();
  });

  it('compares days', () => {
    const day = LocalDate.parse('2026-10-23');
    expect(day.equals(LocalDate.parse('2026-10-23'))).toBe(true);
    expect(day.isBefore(day.plusDays(1))).toBe(true);
  });

  it('reads the wall-clock time in the zone', () => {
    expect(localTimeOf(new Date('2026-10-23T14:30:00Z'), lima)).toBe('09:30');
  });
});
