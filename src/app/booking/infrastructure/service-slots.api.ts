import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { LocalDate } from '../../shared/domain/model/local-date';
import type { Slot as SlotResource } from '../../shared/infrastructure/api/pibble.schema';
import { API_BASE_URL } from '../../shared/infrastructure/http/api-base-url';
import { Slot } from '../domain/model/slot';
import { toSlot } from './slot.assembler';

/** `/api/v1/services/{serviceId}/slots` of pibble. */
@Injectable({ providedIn: 'root' })
export class ServiceSlotsApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /**
   * B16: the free start times of a service on a day of its establishment, from now on, earliest first. With a
   * customer, times they are already busy are left out (B6). The contract names one `Slot`; pibble answers a list.
   * @throws ApiError `SERVICE_NOT_BOOKABLE`, `ACCESS_DENIED`.
   */
  list(serviceId: string, date: LocalDate, customerId: string | null): Observable<Slot[]> {
    return this.http
      .get<SlotResource[]>(`${this.baseUrl}/api/v1/services/${serviceId}/slots`, {
        params: { date: date.toString(), ...(customerId ? { customerId } : {}) },
      })
      .pipe(map((resources) => resources.map(toSlot)));
  }
}
