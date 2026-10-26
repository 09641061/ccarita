import { LocalDate } from '../../../shared/domain/model/local-date';

/** ISO weekday as pibble sends it: 1 is Monday, 7 is Sunday. */
export type IsoWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const WEEKDAYS: readonly IsoWeekday[] = [1, 2, 3, 4, 5, 6, 7];

/** O8: one range of a weekday, local `HH:mm` times in the establishment's time zone. */
export interface OpeningRange {
  readonly weekday: IsoWeekday;
  readonly opensAt: string;
  readonly closesAt: string;
}

/** Why pibble would refuse a range: not an `HH:mm` time, closing not after opening, or overlapping another. */
export type OpeningRangeProblem = 'format' | 'order' | 'overlap';

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * O8: the problem of each range of one weekday, in the order given; `null` where pibble would accept it. Ranges
 * never cross midnight, so 23:59 is the latest closing.
 */
export function rangeProblems(
  ranges: readonly Pick<OpeningRange, 'opensAt' | 'closesAt'>[],
): readonly (OpeningRangeProblem | null)[] {
  return ranges.map((range, index) => {
    if (!TIME.test(range.opensAt) || !TIME.test(range.closesAt)) return 'format';
    if (range.closesAt <= range.opensAt) return 'order';
    const overlaps = ranges.some(
      (other, i) =>
        i !== index &&
        TIME.test(other.opensAt) &&
        TIME.test(other.closesAt) &&
        other.closesAt > other.opensAt &&
        range.opensAt < other.closesAt &&
        other.opensAt < range.closesAt,
    );
    return overlaps ? 'overlap' : null;
  });
}

/** O8: the week of an establishment. A weekday without ranges is closed; several ranges allow split shifts. */
export class OpeningHours {
  /** By weekday, then opening time. */
  readonly ranges: readonly OpeningRange[];

  constructor(ranges: readonly OpeningRange[]) {
    this.ranges = [...ranges].sort(
      (a, b) => a.weekday - b.weekday || a.opensAt.localeCompare(b.opensAt),
    );
  }

  /** The ranges of a weekday, earliest first; empty when closed. */
  on(weekday: IsoWeekday): readonly OpeningRange[] {
    return this.ranges.filter((range) => range.weekday === weekday);
  }

  /** Whether the establishment opens on that day of its calendar. */
  isOpenOn(day: LocalDate): boolean {
    return this.on((day.weekday + 1) as IsoWeekday).length > 0;
  }

  /** A new establishment is closed every day until its hours are set (pibble's "Open establishment"). */
  get isSet(): boolean {
    return this.ranges.length > 0;
  }

  get openWeekdays(): readonly IsoWeekday[] {
    return WEEKDAYS.filter((weekday) => this.on(weekday).length > 0);
  }

  /** O8: every weekday's ranges are times in order that do not overlap. */
  get valid(): boolean {
    return WEEKDAYS.every((weekday) =>
      rangeProblems(this.on(weekday)).every((problem) => problem === null),
    );
  }
}
