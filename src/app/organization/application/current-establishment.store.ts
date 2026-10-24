import { Injectable, computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { TenantContext } from '../../shared/infrastructure/tenancy/tenant-context';
import { Establishment } from '../domain/model/establishment';
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
}
