import { localTimeOf } from '../../../shared/domain/model/local-date';

export type DayPart = 'morning' | 'afternoon';

/** B16: a start time, every 15 minutes, at which a service fits, with the members free for all of it. */
export class Slot {
  constructor(
    readonly start: Date,
    readonly end: Date,
    readonly freeMemberIds: readonly string[],
  ) {}

  isFree(memberId: string): boolean {
    return this.freeMemberIds.includes(memberId);
  }

  /** Morning before noon in the establishment's zone, afternoon from noon on. */
  partOfDay(timeZone: string): DayPart {
    return localTimeOf(this.start, timeZone) < '12:00' ? 'morning' : 'afternoon';
  }
}
