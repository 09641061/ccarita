import { PlanName } from './organization-account';

/** The most days one change may add, as pibble's `ChangePlan.extendDays`. */
export const MAX_EXTEND_DAYS = 3660;
/** The longest note pibble keeps. */
export const MAX_NOTE_LENGTH = 500;

/** O5: how a change moves the end of the paid period. */
export type PlanPeriodChange =
  | { readonly kind: 'extend'; readonly days: number }
  | { readonly kind: 'until'; readonly activeUntil: Date }
  | { readonly kind: 'keep' };

/** O5: what the Takodu team records after a payment, a reversed payment or a plan change. */
export interface ChangePlan {
  /** `null` keeps the plan. */
  readonly plan: PlanName | null;
  readonly period: PlanPeriodChange;
  /** How and when the business paid, such as "Yape 2026-10-23". */
  readonly note: string;
}

/** Why pibble would answer 400; `null` when it would accept the change. */
export type ChangePlanProblem = 'note' | 'noteLength' | 'days' | 'nothing';

export function changePlanProblem(change: ChangePlan): ChangePlanProblem | null {
  const note = change.note.trim();
  if (!note) return 'note';
  if (change.note.length > MAX_NOTE_LENGTH) return 'noteLength';
  const period = change.period;
  if (
    period.kind === 'extend' &&
    (!Number.isInteger(period.days) || period.days < 1 || period.days > MAX_EXTEND_DAYS)
  )
    return 'days';
  if (period.kind === 'keep' && change.plan === null) return 'nothing';
  return null;
}

/** O5: one entry of an organization's append-only plan history. */
export class PlanChange {
  constructor(
    readonly id: string,
    readonly fromPlan: PlanName,
    readonly toPlan: PlanName,
    readonly fromActiveUntil: Date | null,
    readonly toActiveUntil: Date | null,
    readonly note: string,
    /** The operator who made it. */
    readonly changedByEmail: string,
    readonly changedAt: Date,
  ) {}

  get planChanged(): boolean {
    return this.fromPlan !== this.toPlan;
  }

  get endChanged(): boolean {
    return this.fromActiveUntil?.getTime() !== this.toActiveUntil?.getTime();
  }

  /** The new end had already passed when it was set: the plan was stopped, as for a reversed payment. */
  get ended(): boolean {
    return (
      this.endChanged &&
      this.toActiveUntil !== null &&
      this.toActiveUntil.getTime() <= this.changedAt.getTime()
    );
  }
}
