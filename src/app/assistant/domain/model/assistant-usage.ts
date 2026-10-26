import { LocalDate } from '../../../shared/domain/model/local-date';
import { UsagePeriod } from '../../../shared/domain/model/usage-period';

/** A9: answered turns and what they used. Tokens, never money: prices live outside Takodu. */
export interface UsageTotals {
  readonly turns: number;
  readonly inputTokens: number;
  /** Part of `inputTokens` served from the provider's cache. */
  readonly cachedTokens: number;
  readonly outputTokens: number;
  readonly toolCalls: number;
}

/** One day of the establishment with answered turns. */
export interface DailyUsage {
  readonly date: LocalDate;
  readonly totals: UsageTotals;
}

/** A9: an establishment's assistant usage over a period, day by day in its time zone. */
export class AssistantUsage {
  constructor(
    readonly period: UsagePeriod,
    readonly timeZone: string,
    readonly totals: UsageTotals,
    /** Only the days with answered turns, oldest first, as pibble sends them. */
    readonly days: readonly DailyUsage[],
  ) {}

  /** Nothing was answered in the period. */
  get isEmpty(): boolean {
    return this.totals.turns === 0 && this.days.length === 0;
  }

  /** The days with answered turns, newest first, as the usage table lists them. */
  get newestFirst(): readonly DailyUsage[] {
    return [...this.days].reverse();
  }
}
