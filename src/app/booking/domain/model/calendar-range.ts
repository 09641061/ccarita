import { LocalDate } from '../../../shared/domain/model/local-date';

export type CalendarView = 'day' | 'week';

/** The days a calendar shows and the instants pibble is asked for, in the establishment's zone. */
export class CalendarRange {
  private constructor(
    readonly view: CalendarView,
    readonly days: readonly LocalDate[],
    readonly from: Date,
    readonly to: Date,
  ) {}

  /** One day, or the Monday-to-Sunday week that contains it. */
  static of(day: LocalDate, view: CalendarView, timeZone: string): CalendarRange {
    const first = view === 'day' ? day : day.startOfWeek();
    const length = view === 'day' ? 1 : 7;
    const days = Array.from({ length }, (_, i) => first.plusDays(i));
    return new CalendarRange(
      view,
      days,
      first.startIn(timeZone),
      first.plusDays(length).startIn(timeZone),
    );
  }

  /** The day the same distance away: the next or previous day, or the same weekday of another week. */
  static step(day: LocalDate, view: CalendarView, direction: 1 | -1): LocalDate {
    return day.plusDays(direction * (view === 'day' ? 1 : 7));
  }
}
