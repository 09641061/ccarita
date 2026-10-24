import { MemberRole } from './member-role';

/** A person in the organization, or a pending invitation (O9, O10). */
export class Member {
  constructor(
    readonly id: string,
    readonly email: string,
    /** The name the member chose, else their email. */
    readonly name: string,
    readonly role: MemberRole,
    /** O15: only bookable members get appointments. */
    readonly bookable: boolean,
    readonly status: 'pending' | 'active',
    /** O13: the assigned establishments of a staff member; empty for owners and managers. */
    readonly establishmentIds: readonly string[],
  ) {}

  /** O13: owners and managers work at every establishment, staff at their assigned ones. */
  worksAt(establishmentId: string): boolean {
    return this.role !== 'staff' || this.establishmentIds.includes(establishmentId);
  }

  /** O15: an active, bookable member of the establishment, who can have appointments there. */
  takesAppointmentsAt(establishmentId: string): boolean {
    return this.status === 'active' && this.bookable && this.worksAt(establishmentId);
  }
}
