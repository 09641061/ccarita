import { Money } from '../../../shared/domain/model/money';

export type AppointmentStatus = 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';

/** The statuses staff move an appointment to; cancelling has its own command (B12). */
export type StatusChange = 'in_progress' | 'completed' | 'no_show';

export type CancelledBy = 'staff' | 'customer';

/** One customer receiving one service from one member at one establishment (03 §4.4). */
export class Appointment {
  constructor(
    readonly id: string,
    readonly establishmentId: string,
    readonly customerId: string,
    readonly serviceId: string,
    readonly staffMemberId: string,
    readonly start: Date,
    readonly end: Date,
    /** B8: the service's price when it was booked. */
    readonly price: Money,
    readonly status: AppointmentStatus,
    readonly source: 'staff' | 'assistant',
    readonly cancelReason: string | null = null,
    readonly cancelledBy: CancelledBy | null = null,
  ) {}

  /** B10: completed, cancelled and no-show are final. */
  get isFinal(): boolean {
    return this.status === 'completed' || this.status === 'cancelled' || this.status === 'no_show';
  }

  /** B5, B6: confirmed and in-progress appointments hold their member's and customer's time. */
  get occupiesTime(): boolean {
    return this.status === 'confirmed' || this.status === 'in_progress';
  }

  /** B10: only a confirmed appointment starts. */
  get canStart(): boolean {
    return this.status === 'confirmed';
  }

  /** B10: confirmed and in-progress appointments complete. */
  get canComplete(): boolean {
    return this.occupiesTime;
  }

  /** B10, B11: a confirmed appointment becomes a no-show only once it has started. */
  canMarkNoShow(now: Date): boolean {
    return this.status === 'confirmed' && now >= this.start;
  }

  /** B10, B12: confirmed and in-progress appointments can be cancelled, with a reason. */
  get canCancel(): boolean {
    return this.occupiesTime;
  }

  /** B13: only confirmed appointments can be rescheduled. */
  get canReschedule(): boolean {
    return this.status === 'confirmed';
  }

  /** W11, W12: a confirmed appointment that has not started, whose reminder or confirmation can still go. */
  isUpcoming(now: Date): boolean {
    return this.status === 'confirmed' && this.start > now;
  }

  overlaps(start: Date, end: Date): boolean {
    return this.start < end && start < this.end;
  }
}

/** B12: staff record a cancellation the customer asked for in person or by phone as `customer`. */
export interface CancelAppointment {
  readonly reason: string;
  readonly cancelledBy: CancelledBy;
}

/** B1–B9: `staffMemberId` null lets pibble choose the least busy performer that day (B17). */
export interface BookAppointment {
  readonly customerId: string;
  readonly serviceId: string;
  readonly staffMemberId: string | null;
  readonly start: Date;
}

/** B13: a new start, and a new member or null to keep the current one; the length stays. */
export interface RescheduleAppointment {
  readonly start: Date;
  readonly staffMemberId: string | null;
}
