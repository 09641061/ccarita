import { Injectable, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { CurrentEstablishment } from '../../organization/public-api';
import { ApiError } from '../../shared/domain/model/api-error';
import { AssistantSettings, ConfigureAssistant } from '../domain/model/assistant-settings';
import { AssistantApi } from '../infrastructure/assistant.api';

/** A1: the selected establishment's assistant settings, which Ajustes and Primeros pasos show. */
@Injectable({ providedIn: 'root' })
export class AssistantSettingsStore {
  private readonly api = inject(AssistantApi);
  private readonly establishment = inject(CurrentEstablishment);

  /** Reloads with the establishment; `ACCESS_DENIED` for staff. */
  readonly settings = rxResource({
    params: () => this.establishment.id() ?? undefined,
    stream: ({ params }) => this.api.settings(params),
  });

  /**
   * Owners and managers turn the assistant on or off and replace the business info, both at once. After a 409
   * (someone else saved the first settings meanwhile) the settings reload, so the user sees theirs and retries.
   * @throws ApiError `PLAN_INACTIVE` (O6), `ESTABLISHMENT_ARCHIVED`, `ASSISTANT_SETTINGS_CONFLICT`.
   */
  async save(establishmentId: string, command: ConfigureAssistant): Promise<AssistantSettings> {
    try {
      const saved = await firstValueFrom(this.api.configure(establishmentId, command));
      if (this.establishment.id() === establishmentId) this.settings.set(saved);
      return saved;
    } catch (error) {
      if (ApiError.of(error).status === 409) this.settings.reload();
      throw error;
    }
  }
}
