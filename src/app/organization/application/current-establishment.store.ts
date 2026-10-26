import { Injectable, computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { TenantContext } from '../../shared/infrastructure/tenancy/tenant-context';
import { Establishment, EstablishmentDetails } from '../domain/model/establishment';
import { EstablishmentsApi } from '../infrastructure/establishments.api';
import { CurrentOrganization } from './current-organization.store';

/**
 * The establishment the user works in, among those they see (O13). Other contexts key their reads on `id()` and
 * show times in `timeZone()`. Each organization remembers its own selection; one that is archived or no longer
 * visible falls back to the first establishment.
 */
@Injectable({ providedIn: 'root' })
export class CurrentEstablishment {
  private readonly api = inject(EstablishmentsApi);
  private readonly organization = inject(CurrentOrganization);
  private readonly tenant = inject(TenantContext);

  /** Reloads when the organization changes. */
  readonly list = rxResource({
    params: () => this.organization.selected()?.id,
    stream: () => this.api.listVisible(),
    defaultValue: [],
  });

  readonly establishments = computed<readonly Establishment[]>(() =>
    this.list.value().filter((establishment) => !establishment.archived),
  );
  readonly selected = computed<Establishment | null>(() => {
    const establishments = this.establishments();
    return (
      establishments.find((e) => e.id === this.tenant.establishmentId()) ??
      establishments[0] ??
      null
    );
  });
  readonly id = computed(() => this.selected()?.id ?? null);
  /** IANA time zone of the selected establishment; `null` until one is loaded. */
  readonly timeZone = computed(() => this.selected()?.timeZone ?? null);

  select(establishmentId: string): void {
    this.tenant.selectEstablishment(establishmentId);
  }

  /**
   * Owner only: opens another establishment, closed until its hours are set, and selects it.
   * @throws ApiError `PLAN_LIMIT_REACHED` (O4), `PLAN_INACTIVE` (O6).
   */
  async open(details: EstablishmentDetails, idempotencyKey: string): Promise<Establishment> {
    const opened = await firstValueFrom(this.api.open(details, idempotencyKey));
    this.select(opened.id);
    this.list.reload();
    return opened;
  }

  /** Owner only: name, address and time zone (O7). @throws ApiError `PLAN_INACTIVE`, `ESTABLISHMENT_ARCHIVED`. */
  async describe(establishmentId: string, details: EstablishmentDetails): Promise<Establishment> {
    const described = await firstValueFrom(this.api.describe(establishmentId, details));
    this.list.reload();
    return described;
  }

  /** O4: owner only, also with an inactive plan. The selection falls back to the first one left. */
  async archive(establishmentId: string): Promise<Establishment> {
    const archived = await firstValueFrom(this.api.archive(establishmentId));
    this.list.reload();
    return archived;
  }
}
