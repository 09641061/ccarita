import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import type {
  Appointment as AppointmentResource,
  ChangeAppointmentStatusRequest,
} from '../../shared/infrastructure/api/pibble.schema';
import { API_BASE_URL } from '../../shared/infrastructure/http/api-base-url';
import { idempotent } from '../../shared/infrastructure/http/idempotency';
import {
  Appointment,
  BookAppointment,
  CancelAppointment,
  RescheduleAppointment,
  StatusChange,
} from '../domain/model/appointment';
import {
  toAppointment,
  toBookAppointmentRequest,
  toCancelAppointmentRequest,
  toRescheduleAppointmentRequest,
} from './appointment.assembler';

/** `/api/v1/appointments` and the establishment calendar of pibble. */
@Injectable({ providedIn: 'root' })
export class AppointmentsApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** Appointments in every status overlapping `[from, to)`, earliest first; pibble allows at most 42 days. */
  listForEstablishment(establishmentId: string, from: Date, to: Date): Observable<Appointment[]> {
    return this.http
      .get<AppointmentResource[]>(
        `${this.baseUrl}/api/v1/establishments/${establishmentId}/appointments`,
        { params: { from: from.toISOString(), to: to.toISOString() } },
      )
      .pipe(map((resources) => resources.map(toAppointment)));
  }

  get(appointmentId: string): Observable<Appointment> {
    return this.http
      .get<AppointmentResource>(`${this.baseUrl}/api/v1/appointments/${appointmentId}`)
      .pipe(map(toAppointment));
  }

  /** B10, B11. @throws ApiError `INVALID_TRANSITION`, `NO_SHOW_BEFORE_START`, `APPOINTMENT_CONFLICT`. */
  changeStatus(
    appointmentId: string,
    status: StatusChange,
    idempotencyKey: string,
  ): Observable<Appointment> {
    const body: ChangeAppointmentStatusRequest = { status };
    return this.http
      .post<AppointmentResource>(
        `${this.baseUrl}/api/v1/appointments/${appointmentId}/status-changes`,
        body,
        { context: idempotent(idempotencyKey) },
      )
      .pipe(map(toAppointment));
  }

  /** B12. @throws ApiError `INVALID_TRANSITION`, `APPOINTMENT_CONFLICT`. */
  cancel(
    appointmentId: string,
    command: CancelAppointment,
    idempotencyKey: string,
  ): Observable<Appointment> {
    return this.http
      .post<AppointmentResource>(
        `${this.baseUrl}/api/v1/appointments/${appointmentId}/cancellations`,
        toCancelAppointmentRequest(command),
        { context: idempotent(idempotencyKey) },
      )
      .pipe(map(toAppointment));
  }

  /**
   * B1–B9, B17. @throws ApiError `PLAN_INACTIVE`, `SLOT_UNAVAILABLE`, `OUTSIDE_OPENING_HOURS`, `TIME_BLOCKED`,
   * `OUTSIDE_BOOKING_WINDOW`, `MEMBER_CANNOT_PERFORM_SERVICE`, `SERVICE_NOT_BOOKABLE`.
   */
  book(command: BookAppointment, idempotencyKey: string): Observable<Appointment> {
    return this.http
      .post<AppointmentResource>(
        `${this.baseUrl}/api/v1/appointments`,
        toBookAppointmentRequest(command),
        { context: idempotent(idempotencyKey) },
      )
      .pipe(map(toAppointment));
  }

  /** B13: re-runs B2–B6 and B9. @throws ApiError as `book`, plus `INVALID_TRANSITION`, `APPOINTMENT_CONFLICT`. */
  reschedule(
    appointmentId: string,
    command: RescheduleAppointment,
    idempotencyKey: string,
  ): Observable<Appointment> {
    return this.http
      .post<AppointmentResource>(
        `${this.baseUrl}/api/v1/appointments/${appointmentId}/reschedulings`,
        toRescheduleAppointmentRequest(command),
        { context: idempotent(idempotencyKey) },
      )
      .pipe(map(toAppointment));
  }
}
