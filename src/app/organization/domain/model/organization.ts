import { EstablishmentDetails } from './establishment';
import { planActiveAt } from './plan';

/** O1: the business, its first establishment and how the owner is shown to the team. */
export interface CreateOrganization {
  readonly name: string;
  readonly establishment: EstablishmentDetails;
  readonly ownerDisplayName: string;
}

export type PlanKind = 'standard' | 'max';

/** The selected organization as pibble describes it, with its plan (O5). */
export class Organization {
  constructor(
    readonly id: string,
    readonly name: string,
    readonly plan: PlanKind,
    readonly planActiveUntil: Date,
  ) {}

  /** O5, O6. */
  planActive(now: Date): boolean {
    return planActiveAt(this.planActiveUntil, now);
  }
}
