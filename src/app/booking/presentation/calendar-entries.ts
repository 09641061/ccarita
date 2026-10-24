import { KnownCustomer } from '../../customers/public-api';
import { Member, Service } from '../../organization/public-api';
import { LocalDate } from '../../shared/domain/model/local-date';
import { Appointment } from '../domain/model/appointment';
import { TimeBlock } from '../domain/model/time-block';

/** An appointment with the names a calendar shows. Names are `null` while unknown; templates fall back. */
export interface AppointmentEntry {
  readonly kind: 'appointment';
  readonly id: string;
  readonly appointment: Appointment;
  readonly start: Date;
  readonly end: Date;
  /** `null` while loading. */
  readonly customerName: string | null;
  readonly customerDeleted: boolean;
  readonly serviceName: string | null;
  readonly memberName: string | null;
  readonly memberIndex: number;
  /** B15: the block it collides with: `whole` for the establishment's, else the member's name. */
  readonly conflict: { readonly whole: boolean; readonly name: string | null } | null;
}

/** A time block, cut to the day it is drawn in. */
export interface BlockEntry {
  readonly kind: 'block';
  readonly id: string;
  readonly block: TimeBlock;
  readonly start: Date;
  readonly end: Date;
  /** `null` for the whole establishment. */
  readonly memberName: string | null;
  readonly manageable: boolean;
}

export type CalendarEntry = AppointmentEntry | BlockEntry;

export interface EntrySources {
  readonly members: ReadonlyMap<string, Member>;
  readonly memberOrder: readonly string[];
  readonly services: ReadonlyMap<string, Service>;
  readonly customers: ReadonlyMap<string, KnownCustomer>;
  readonly conflicts: ReadonlyMap<string, TimeBlock>;
  readonly canManage: (block: TimeBlock) => boolean;
}

export function appointmentEntry(
  appointment: Appointment,
  sources: EntrySources,
): AppointmentEntry {
  const customer = sources.customers.get(appointment.customerId);
  const conflict = sources.conflicts.get(appointment.id);
  return {
    kind: 'appointment',
    id: appointment.id,
    appointment,
    start: appointment.start,
    end: appointment.end,
    customerName: customer && customer !== 'deleted' ? customer.displayName : null,
    customerDeleted: customer === 'deleted',
    serviceName: sources.services.get(appointment.serviceId)?.name ?? null,
    memberName: sources.members.get(appointment.staffMemberId)?.name ?? null,
    memberIndex: Math.max(0, sources.memberOrder.indexOf(appointment.staffMemberId)),
    conflict: conflict
      ? {
          whole: conflict.coversWholeEstablishment,
          name: conflict.staffMemberId
            ? (sources.members.get(conflict.staffMemberId)?.name ?? null)
            : null,
        }
      : null,
  };
}

/** The entries of one day in the establishment's zone, earliest first; blocks are cut to the day. */
export function entriesOfDay(
  day: LocalDate,
  timeZone: string,
  appointments: readonly Appointment[],
  blocks: readonly TimeBlock[],
  sources: EntrySources,
): CalendarEntry[] {
  const dayStart = day.startIn(timeZone);
  const dayEnd = day.plusDays(1).startIn(timeZone);
  const entries: CalendarEntry[] = [];
  for (const appointment of appointments) {
    if (LocalDate.of(appointment.start, timeZone).equals(day))
      entries.push(appointmentEntry(appointment, sources));
  }
  for (const block of blocks) {
    if (block.start >= dayEnd || block.end <= dayStart) continue;
    entries.push({
      kind: 'block',
      id: block.id,
      block,
      start: block.start > dayStart ? block.start : dayStart,
      end: block.end < dayEnd ? block.end : dayEnd,
      memberName: block.staffMemberId
        ? (sources.members.get(block.staffMemberId)?.name ?? null)
        : null,
      manageable: sources.canManage(block),
    });
  }
  return entries.sort(
    (a, b) =>
      a.start.getTime() - b.start.getTime() ||
      (a.kind === b.kind ? 0 : a.kind === 'block' ? -1 : 1),
  );
}
