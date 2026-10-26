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

/** One day of an establishment with answered turns. */
export interface DailyUsage {
  readonly date: LocalDate;
  readonly totals: UsageTotals;
}

/** A9: one establishment's usage, its days read in its own time zone. */
export interface EstablishmentUsage {
  readonly establishmentId: string;
  readonly name: string;
  readonly timeZone: string;
  readonly totals: UsageTotals;
  /** Only days with answered turns, oldest first. */
  readonly days: readonly DailyUsage[];
}

/** A9: an organization's assistant usage over a period, per establishment and summed. */
export class OrganizationUsage {
  constructor(
    readonly period: UsagePeriod,
    readonly totals: UsageTotals,
    /** Establishments with answered turns, by name. */
    readonly establishments: readonly EstablishmentUsage[],
  ) {}

  get isEmpty(): boolean {
    return this.totals.turns === 0 && this.establishments.length === 0;
  }
}
