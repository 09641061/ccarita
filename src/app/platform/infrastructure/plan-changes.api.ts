import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import type { PlanChange as PlanChangeResource } from '../../shared/infrastructure/api/pibble.schema';
import { API_BASE_URL } from '../../shared/infrastructure/http/api-base-url';
import { idempotent } from '../../shared/infrastructure/http/idempotency';
import { ChangePlan, PlanChange } from '../domain/model/plan-change';
import { toChangePlanRequest, toPlanChange } from './platform.assembler';

/** `/internal/v1/organizations/{id}/plan-changes`: the append-only plan history (O5). */
@Injectable({ providedIn: 'root' })
export class PlanChangesApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** Newest first. */
  list(organizationId: string): Observable<PlanChange[]> {
    return this.http
      .get<PlanChangeResource[]>(this.url(organizationId))
      .pipe(map((resources) => resources.map(toPlanChange)));
  }

  /** A repeated key returns the change the first request made, once. */
  change(
    organizationId: string,
    change: ChangePlan,
    idempotencyKey: string,
  ): Observable<PlanChange> {
    return this.http
      .post<PlanChangeResource>(this.url(organizationId), toChangePlanRequest(change), {
        context: idempotent(idempotencyKey),
      })
      .pipe(map(toPlanChange));
  }

  private url(organizationId: string): string {
    return `${this.baseUrl}/internal/v1/organizations/${organizationId}/plan-changes`;
  }
}
