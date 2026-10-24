import type {
  Appointment as AppointmentResource,
  CancelAppointmentRequest,
} from '../../shared/infrastructure/api/pibble.schema';
import { Money } from '../../shared/domain/model/money';
import { required } from '../../shared/infrastructure/api/required';
import { Appointment, CancelAppointment } from '../domain/model/appointment';

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
