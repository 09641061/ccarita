import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import type { Service as ServiceResource } from '../../shared/infrastructure/api/pibble.schema';
import { API_BASE_URL } from '../../shared/infrastructure/http/api-base-url';
import { idempotent } from '../../shared/infrastructure/http/idempotency';
import { Service } from '../domain/model/service';
import { ServiceDetails } from '../domain/model/service-details';
import { toService, toServiceDetailsRequest } from './organization.assembler';

/** `/api/v1/establishments/{id}/services` and `/api/v1/services/{id}`; owners and managers change them. */
@Injectable({ providedIn: 'root' })
export class ServicesApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** The establishment's services, deactivated ones included (O14). */
  listForEstablishment(establishmentId: string): Observable<Service[]> {
    return this.http
      .get<ServiceResource[]>(`${this.baseUrl}/api/v1/establishments/${establishmentId}/services`)
      .pipe(map((resources) => resources.map(toService)));
  }

  /** O14, O15. @throws ApiError `PERFORMER_NOT_ELIGIBLE`, `ESTABLISHMENT_ARCHIVED`, `PLAN_INACTIVE`. */
  create(
    establishmentId: string,
    details: ServiceDetails,
    idempotencyKey: string,
  ): Observable<Service> {
    return this.http
      .post<ServiceResource>(
        `${this.baseUrl}/api/v1/establishments/${establishmentId}/services`,
        toServiceDetailsRequest(details),
        { context: idempotent(idempotencyKey) },
      )
      .pipe(map(toService));
  }

  /** Replaces the whole service; booked appointments keep their price (B8). */
  update(serviceId: string, details: ServiceDetails): Observable<Service> {
    return this.http
      .put<ServiceResource>(
        `${this.baseUrl}/api/v1/services/${serviceId}`,
        toServiceDetailsRequest(details),
      )
      .pipe(map(toService));
  }

  /** O14: offers it again (`true`) or no longer (`false`); repeating it changes nothing, so no key. */
  setActive(serviceId: string, active: boolean): Observable<Service> {
    const action = active ? 'activations' : 'deactivations';
    return this.http
      .post<ServiceResource>(`${this.baseUrl}/api/v1/services/${serviceId}/${action}`, null)
      .pipe(map(toService));
  }
}
