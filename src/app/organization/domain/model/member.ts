import { MemberRole } from './member-role';

/** O10: the roles an invitation or an edit may give; owner only comes from a transfer (O12). */
export type AssignableRole = Exclude<MemberRole, 'owner'>;

/** O10: who to invite, as the team will see them. */
export interface InviteMember {
  readonly email: string;
  readonly displayName: string;
  readonly role: AssignableRole;
  readonly bookable: boolean;
  /** O13: where a staff member works; ignored for managers. */
  readonly establishmentIds: readonly string[];
}

/** O9, O13, O15: the whole editable state of a member; the owner keeps the role `owner` (O12). */
export interface UpdateMember {
  readonly displayName: string;
  readonly bookable: boolean;
  readonly role: MemberRole;
  readonly establishmentIds: readonly string[];
}

/** O13: staff work somewhere; `null` when pibble would accept the assignment. */
export function assignmentProblem(
  role: MemberRole,
  establishmentIds: readonly string[],
): 'noEstablishment' | null {
  return role === 'staff' && establishmentIds.length === 0 ? 'noEstablishment' : null;
}

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
    readonly joinedAt: Date | null = null,
    /** O10: when a pending invitation's link stops working. */
    readonly inviteExpiresAt: Date | null = null,
  ) {}

  get isOwner(): boolean {
    return this.role === 'owner';
  }

  /** O13: owners and managers work at every establishment, staff at their assigned ones. */
  worksAt(establishmentId: string): boolean {
    return this.role !== 'staff' || this.establishmentIds.includes(establishmentId);
  }

  /** O15: an active, bookable member of the establishment, who can have appointments there. */
  takesAppointmentsAt(establishmentId: string): boolean {
    return this.status === 'active' && this.bookable && this.worksAt(establishmentId);
  }

  /** O10: a pending invitation whose 7 days have passed; it can still be renewed. */
  invitationExpired(now: Date): boolean {
    return (
      this.status === 'pending' &&
      this.inviteExpiresAt !== null &&
      now.getTime() >= this.inviteExpiresAt.getTime()
    );
  }
}
