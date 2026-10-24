import { Appointment } from './appointment';

/** B15: a range in which one member, or the whole establishment, cannot be booked. */
export class TimeBlock {
  constructor(
    readonly id: string,
    readonly establishmentId: string,
    /** `null` blocks the whole establishment. */
    readonly staffMemberId: string | null,
    readonly start: Date,
    readonly end: Date,
    readonly reason: string | null,
  ) {}

  get coversWholeEstablishment(): boolean {
    return this.staffMemberId === null;
  }

  /** Whether the block applies to this member: theirs or the whole establishment's. */
  appliesTo(memberId: string): boolean {
    return this.coversWholeEstablishment || this.staffMemberId === memberId;
  }

  /** B15: a block cancels nothing, so the calendar shows the booked appointments it overlaps. */
  conflictsWith(appointment: Appointment): boolean {
    return (
      appointment.occupiesTime &&
      this.appliesTo(appointment.staffMemberId) &&
      appointment.overlaps(this.start, this.end)
    );
  }

  /**
   * B15: every member manages their own blocks; owners and managers manage everyone's and the whole
   * establishment's.
   */
  canBeManagedBy(memberId: string | null, managesEveryone: boolean): boolean {
    return managesEveryone || (memberId !== null && this.staffMemberId === memberId);
  }
}

/** B15: `staffMemberId` null blocks the whole establishment; pibble allows at most 366 days. */
export interface CreateTimeBlock {
  readonly staffMemberId: string | null;
  readonly start: Date;
  readonly end: Date;
  readonly reason: string | null;
}
