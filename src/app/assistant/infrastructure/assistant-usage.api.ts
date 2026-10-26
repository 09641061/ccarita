import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import type { AssistantUsage as AssistantUsageResource } from '../../shared/infrastructure/api/pibble.schema';
import { API_BASE_URL } from '../../shared/infrastructure/http/api-base-url';
import { AssistantUsage } from '../domain/model/assistant-usage';
import { UsagePeriod } from '../../shared/domain/model/usage-period';
import { toAssistantUsage } from './assistant.assembler';

/** `/api/v1/establishments/{id}/assistant/usage`: owners and managers, also while the plan is inactive (A9). */
@Injectable({ providedIn: 'root' })
export class AssistantUsageApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  forPeriod(establishmentId: string, period: UsagePeriod): Observable<AssistantUsage> {
    return this.http
      .get<AssistantUsageResource>(
        `${this.baseUrl}/api/v1/establishments/${establishmentId}/assistant/usage`,
        { params: { from: period.from.toString(), to: period.to.toString() } },
      )
      .pipe(map(toAssistantUsage));
  }
}
