import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import type { Service as ServiceResource } from '../../shared/infrastructure/api/pibble.schema';
import { API_BASE_URL } from '../../shared/infrastructure/http/api-base-url';
import { Service } from '../domain/model/service';
import { toService } from './organization.assembler';

/** `/api/v1/establishments/{id}/services`. */
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
}
