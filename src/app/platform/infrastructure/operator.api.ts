import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import type { User as UserResource } from '../../shared/infrastructure/api/pibble.schema';
import { API_BASE_URL } from '../../shared/infrastructure/http/api-base-url';

/** `/internal/v1/operator`: answers only when the signed-in user is on the Takodu team. */
@Injectable({ providedIn: 'root' })
export class OperatorApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** @throws ApiError `ACCESS_DENIED` (403) for anyone else. */
  check(): Observable<void> {
    return this.http
      .get<UserResource>(`${this.baseUrl}/internal/v1/operator`)
      .pipe(map(() => undefined));
  }
}
