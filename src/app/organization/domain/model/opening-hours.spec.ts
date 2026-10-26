import { LocalDate } from '../../../shared/domain/model/local-date';
import { OpeningHours, rangeProblems } from './opening-hours';

describe('rangeProblems', () => {
  it('O8: accepts split shifts that do not overlap, closing at 23:59 at the latest', () => {
    expect(
      rangeProblems([
        { opensAt: '09:00', closesAt: '13:00' },
        { opensAt: '13:00', closesAt: '23:59' },
      ]),
    ).toEqual([null, null]);
  });

  it('O8: refuses a range that closes before or when it opens, or crosses midnight', () => {
    expect(
      rangeProblems([
        { opensAt: '10:00', closesAt: '10:00' },
        { opensAt: '22:00', closesAt: '02:00' },
      ]),
    ).toEqual(['order', 'order']);
  });

  it('O8: marks both overlapping ranges', () => {
    expect(
      rangeProblems([
        { opensAt: '09:00', closesAt: '13:00' },
        { opensAt: '12:30', closesAt: '18:00' },
        { opensAt: '18:00', closesAt: '20:00' },
      ]),
    ).toEqual(['overlap', 'overlap', null]);
  });

  it('refuses what is not an HH:mm time', () => {
    expect(
      rangeProblems([
        { opensAt: '9:00', closesAt: '13:00' },
        { opensAt: '', closesAt: '24:00' },
      ]),
    ).toEqual(['format', 'format']);
  });
});

describe('OpeningHours', () => {
  const hours = new OpeningHours([
    { weekday: 6, opensAt: '09:00', closesAt: '14:00' },
    { weekday: 1, opensAt: '15:00', closesAt: '19:00' },
    { weekday: 1, opensAt: '09:00', closesAt: '13:00' },
  ]);

  it('sorts by weekday and opening time', () => {
    expect(hours.on(1).map((r) => r.opensAt)).toEqual(['09:00', '15:00']);
    expect(hours.openWeekdays).toEqual([1, 6]);
  });

  it('O8: a weekday without ranges is closed', () => {
    expect(hours.isOpenOn(LocalDate.parse('2026-10-26'))).toBe(true); // Monday
    expect(hours.isOpenOn(LocalDate.parse('2026-10-25'))).toBe(false); // Sunday
  });

  it('a new establishment has no hours set', () => {
    expect(new OpeningHours([]).isSet).toBe(false);
    expect(hours.isSet).toBe(true);
  });

  it('O8: is valid only when no weekday has a problem', () => {
    expect(hours.valid).toBe(true);
    expect(
      new OpeningHours([
        { weekday: 2, opensAt: '09:00', closesAt: '12:00' },
        { weekday: 2, opensAt: '11:00', closesAt: '14:00' },
      ]).valid,
    ).toBe(false);
  });
});
