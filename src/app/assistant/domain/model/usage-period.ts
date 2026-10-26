import { LocalDate } from '../../../shared/domain/model/local-date';

/** Why pibble would refuse a period: the last day before the first, or more than 366 days. */
export type UsagePeriodProblem = 'order' | 'length';

/**
 * A9: whole days of the establishment, both included, read in its time zone, as pibble's `UsagePeriod`: at most
 * 366 days at a time.
 */
export class UsagePeriod {
  static readonly MAX_DAYS = 366;

  private constructor(
    readonly from: LocalDate,
    readonly to: LocalDate,
  ) {}

  /** `null` where pibble would accept the period. */
  static problemOf(from: LocalDate, to: LocalDate): UsagePeriodProblem | null {
    if (to.isBefore(from)) return 'order';
    if (from.daysUntil(to) >= UsagePeriod.MAX_DAYS) return 'length';
    return null;
  }

  /** @throws Error when pibble would refuse it (`problemOf`). */
  static of(from: LocalDate, to: LocalDate): UsagePeriod {
    const problem = UsagePeriod.problemOf(from, to);
    if (problem) throw new Error(`Not a usage period (${problem}): ${from} to ${to}`);
    return new UsagePeriod(from, to);
  }

  /** The last `days` days of the establishment, today included. */
  static lastDays(days: number, now: Date, timeZone: string): UsagePeriod {
    const today = LocalDate.of(now, timeZone);
    return UsagePeriod.of(today.plusDays(1 - days), today);
  }

  /** How many days it covers. */
  get days(): number {
    return this.from.daysUntil(this.to) + 1;
  }

  equals(other: UsagePeriod | null | undefined): boolean {
    return !!other && this.from.equals(other.from) && this.to.equals(other.to);
  }
}
