import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import type { Establishment as EstablishmentResource } from '../../shared/infrastructure/api/pibble.schema';
import { API_BASE_URL } from '../../shared/infrastructure/http/api-base-url';
import { Establishment } from '../domain/model/establishment';
import { toEstablishment } from './organization.assembler';

/** `/api/v1/establishments` of the selected organization. */
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
}
