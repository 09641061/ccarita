import type {
  Appointment as AppointmentResource,
  BookAppointmentRequest,
  CancelAppointmentRequest,
  RescheduleAppointmentRequest,
} from '../../shared/infrastructure/api/pibble.schema';
import { Money } from '../../shared/domain/model/money';
import { required } from '../../shared/infrastructure/api/required';
import {
  Appointment,
  BookAppointment,
  CancelAppointment,
  RescheduleAppointment,
} from '../domain/model/appointment';

export function toAppointment(resource: AppointmentResource): Appointment {
  return new Appointment(
    required(resource.id, 'Appointment.id'),
    required(resource.establishmentId, 'Appointment.establishmentId'),
    required(resource.customerId, 'Appointment.customerId'),
    required(resource.serviceId, 'Appointment.serviceId'),
    required(resource.staffMemberId, 'Appointment.staffMemberId'),
    new Date(required(resource.start, 'Appointment.start')),
    new Date(required(resource.end, 'Appointment.end')),
    new Money(required(resource.priceCents, 'Appointment.priceCents'), resource.currency ?? 'PEN'),
    required(resource.status, 'Appointment.status'),
    required(resource.source, 'Appointment.source'),
    resource.cancelReason ?? null,
    resource.cancelledBy ?? null,
  );
}

export function toCancelAppointmentRequest(command: CancelAppointment): CancelAppointmentRequest {
  return { reason: command.reason.trim(), cancelledBy: command.cancelledBy };
}

/** A null member is left out, so pibble chooses one (B17). */
export function toBookAppointmentRequest(command: BookAppointment): BookAppointmentRequest {
  return {
    customerId: command.customerId,
    serviceId: command.serviceId,
    ...(command.staffMemberId ? { staffMemberId: command.staffMemberId } : {}),
    start: command.start.toISOString(),
  };
}

/** A null member is left out, so the appointment keeps its member (B13). */
export function toRescheduleAppointmentRequest(
  command: RescheduleAppointment,
): RescheduleAppointmentRequest {
  return {
    ...(command.staffMemberId ? { staffMemberId: command.staffMemberId } : {}),
    start: command.start.toISOString(),
  };
}
