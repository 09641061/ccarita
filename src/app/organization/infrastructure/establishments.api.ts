import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import type {
  Establishment as EstablishmentResource,
  OpeningHours as OpeningHoursResource,
} from '../../shared/infrastructure/api/pibble.schema';
import { API_BASE_URL } from '../../shared/infrastructure/http/api-base-url';
import { idempotent } from '../../shared/infrastructure/http/idempotency';
import { Establishment, EstablishmentDetails } from '../domain/model/establishment';
import { OpeningHours } from '../domain/model/opening-hours';
import {
  toEstablishment,
  toEstablishmentDetailsRequest,
  toOpeningHours,
  toOpeningHoursResource,
} from './organization.assembler';

/** `/api/v1/establishments` of the selected organization, with their opening hours. */
@Injectable({ providedIn: 'root' })
export class EstablishmentsApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** O13: all active establishments for owners and managers, the assigned ones for staff. */
  listVisible(): Observable<Establishment[]> {
    return this.http
      .get<EstablishmentResource[]>(`${this.baseUrl}/api/v1/establishments`)
      .pipe(map((resources) => resources.map(toEstablishment)));
  }

  /**
   * Owner only; the new establishment is closed until its hours are set.
   * @throws ApiError `PLAN_LIMIT_REACHED` (O4), `PLAN_INACTIVE` (O6).
   */
  open(details: EstablishmentDetails, idempotencyKey: string): Observable<Establishment> {
    return this.http
      .post<EstablishmentResource>(
        `${this.baseUrl}/api/v1/establishments`,
        toEstablishmentDetailsRequest(details),
        { context: idempotent(idempotencyKey) },
      )
      .pipe(map(toEstablishment));
  }

  /** Owner only: name, address and time zone (O7). @throws ApiError `ESTABLISHMENT_ARCHIVED`, `PLAN_INACTIVE`. */
  describe(establishmentId: string, details: EstablishmentDetails): Observable<Establishment> {
    return this.http
      .put<EstablishmentResource>(
        `${this.baseUrl}/api/v1/establishments/${establishmentId}`,
        toEstablishmentDetailsRequest(details),
      )
      .pipe(map(toEstablishment));
  }

  /** Owner only, also while the plan is inactive (O4, O6); archiving twice changes nothing, so no key. */
  archive(establishmentId: string): Observable<Establishment> {
    return this.http
      .post<EstablishmentResource>(
        `${this.baseUrl}/api/v1/establishments/${establishmentId}/archivals`,
        null,
      )
      .pipe(map(toEstablishment));
  }

  openingHours(establishmentId: string): Observable<OpeningHours> {
    return this.http
      .get<OpeningHoursResource>(
        `${this.baseUrl}/api/v1/establishments/${establishmentId}/opening-hours`,
      )
      .pipe(map(toOpeningHours));
  }

  /** O8: replaces the whole week; appointments already booked outside it stay. */
  replaceOpeningHours(establishmentId: string, hours: OpeningHours): Observable<OpeningHours> {
    return this.http
      .put<OpeningHoursResource>(
        `${this.baseUrl}/api/v1/establishments/${establishmentId}/opening-hours`,
        toOpeningHoursResource(hours),
      )
      .pipe(map(toOpeningHours));
  }
}
