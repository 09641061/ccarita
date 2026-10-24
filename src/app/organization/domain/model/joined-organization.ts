import { MemberRole } from './member-role';
import { planActiveAt } from './plan';

/** An organization the signed-in user belongs to, with their membership and role in it (O9). */
export class JoinedOrganization {
  constructor(
    readonly id: string,
    readonly name: string,
    readonly planActiveUntil: Date,
    readonly memberId: string,
    readonly role: MemberRole,
  ) {}

  /** O5, O6: while false, booking, sending and changing settings are rejected. */
  planActive(now: Date): boolean {
    return planActiveAt(this.planActiveUntil, now);
  }
}
