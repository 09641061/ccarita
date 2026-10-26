import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import type { AssistantSettings as AssistantSettingsResource } from '../../shared/infrastructure/api/pibble.schema';
import { API_BASE_URL } from '../../shared/infrastructure/http/api-base-url';
import { AssistantSettings, ConfigureAssistant } from '../domain/model/assistant-settings';
import { toAssistantSettings, toAssistantSettingsRequest } from './assistant.assembler';

/** `/api/v1/establishments/{id}/assistant`: owners and managers only (03 §5). */
@Injectable({ providedIn: 'root' })
export class AssistantApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** Off with no business info until someone configures it. */
  settings(establishmentId: string): Observable<AssistantSettings> {
    return this.http
      .get<AssistantSettingsResource>(this.url(establishmentId))
      .pipe(map(toAssistantSettings));
  }

  /**
   * A1: replaces both fields. A PUT, so no idempotency key.
   * @throws ApiError `PLAN_INACTIVE`, `ESTABLISHMENT_ARCHIVED`, `ASSISTANT_SETTINGS_CONFLICT` (someone else saved the
   * first settings meanwhile).
   */
  configure(establishmentId: string, command: ConfigureAssistant): Observable<AssistantSettings> {
    return this.http
      .put<AssistantSettingsResource>(
        this.url(establishmentId),
        toAssistantSettingsRequest(command),
      )
      .pipe(map(toAssistantSettings));
  }

  private url(establishmentId: string): string {
    return `${this.baseUrl}/api/v1/establishments/${establishmentId}/assistant`;
  }
}
