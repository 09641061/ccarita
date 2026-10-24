import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import type { TimeBlock as TimeBlockResource } from '../../shared/infrastructure/api/pibble.schema';
import { API_BASE_URL } from '../../shared/infrastructure/http/api-base-url';
import { idempotent } from '../../shared/infrastructure/http/idempotency';
import { CreateTimeBlock, TimeBlock } from '../domain/model/time-block';
import { toCreateTimeBlockRequest, toTimeBlock } from './time-block.assembler';

/** `/api/v1/establishments/{id}/time-blocks` and `/api/v1/time-blocks/{id}` (B15). */
@Injectable({ providedIn: 'root' })
export class TimeBlocksApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** Blocks overlapping `[from, to)`, earliest first; at most 42 days. */
  listForEstablishment(establishmentId: string, from: Date, to: Date): Observable<TimeBlock[]> {
    return this.http
      .get<TimeBlockResource[]>(
        `${this.baseUrl}/api/v1/establishments/${establishmentId}/time-blocks`,
        { params: { from: from.toISOString(), to: to.toISOString() } },
      )
      .pipe(map((resources) => resources.map(toTimeBlock)));
  }

  /** Works while the plan is inactive (O6). @throws ApiError `ACCESS_DENIED`, `MEMBER_NOT_AT_ESTABLISHMENT`. */
  create(
    establishmentId: string,
    command: CreateTimeBlock,
    idempotencyKey: string,
  ): Observable<TimeBlock> {
    return this.http
      .post<TimeBlockResource>(
        `${this.baseUrl}/api/v1/establishments/${establishmentId}/time-blocks`,
        toCreateTimeBlockRequest(command),
        { context: idempotent(idempotencyKey) },
      )
      .pipe(map(toTimeBlock));
  }

  /** @throws ApiError `ACCESS_DENIED`, `TIME_BLOCK_NOT_FOUND`. */
  delete(timeBlockId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/api/v1/time-blocks/${timeBlockId}`);
  }
}
