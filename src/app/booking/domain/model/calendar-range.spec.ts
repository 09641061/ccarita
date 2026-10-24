import { LocalDate } from '../../../shared/domain/model/local-date';
import { CalendarRange } from './calendar-range';

describe('CalendarRange', () => {
  const friday = LocalDate.parse('2026-10-23');

  it('asks for one local day', () => {
    const range = CalendarRange.of(friday, 'day', 'America/Lima');
    expect(range.days.map(String)).toEqual(['2026-10-23']);
    expect(range.from.toISOString()).toBe('2026-10-23T05:00:00.000Z');
    expect(range.to.toISOString()).toBe('2026-10-24T05:00:00.000Z');
  });

  it('asks for the Monday-to-Sunday week of the day', () => {
    const range = CalendarRange.of(friday, 'week', 'America/Lima');
    expect(range.days.map(String)).toEqual([
      '2026-10-19',
      '2026-10-20',
      '2026-10-21',
      '2026-10-22',
      '2026-10-23',
      '2026-10-24',
      '2026-10-25',
    ]);
    expect(range.to.toISOString()).toBe('2026-10-26T05:00:00.000Z');
  });

  it('steps a day or a week', () => {
    expect(CalendarRange.step(friday, 'day', -1).toString()).toBe('2026-10-22');
    expect(CalendarRange.step(friday, 'week', 1).toString()).toBe('2026-10-30');
  });
});
