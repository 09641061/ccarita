import { Injectable, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { OpeningHours } from '../domain/model/opening-hours';
import { EstablishmentsApi } from '../infrastructure/establishments.api';
import { CurrentEstablishment } from './current-establishment.store';

/** O8: the opening hours of the selected establishment, which the calendar and booking mark closed days by. */
@Injectable({ providedIn: 'root' })
export class OpeningHoursStore {
  private readonly api = inject(EstablishmentsApi);
  private readonly establishment = inject(CurrentEstablishment);

  /** Reloads with the establishment. */
  readonly hours = rxResource({
    params: () => this.establishment.id() ?? undefined,
    stream: ({ params }) => this.api.openingHours(params),
  });

  /**
   * Owners and managers replace the whole week.
   * @throws ApiError `VALIDATION_ERROR` (O8), `PLAN_INACTIVE` (O6), `ESTABLISHMENT_ARCHIVED`.
   */
  async replace(establishmentId: string, hours: OpeningHours): Promise<OpeningHours> {
    const saved = await firstValueFrom(this.api.replaceOpeningHours(establishmentId, hours));
    if (this.establishment.id() === establishmentId) this.hours.set(saved);
    return saved;
  }
}
