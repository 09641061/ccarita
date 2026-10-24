import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiError } from '../../shared/domain/model/api-error';
import { TenantContext } from '../../shared/infrastructure/tenancy/tenant-context';
import { Customer } from '../domain/model/customer';
import { CustomersApi } from '../infrastructure/customers.api';

/** What is known of one customer: loaded, deleted (pibble no longer serves it, C5), or not yet known. */
export type KnownCustomer = Customer | 'deleted';

interface Directory {
  readonly organizationId: string | null;
  readonly customers: ReadonlyMap<string, KnownCustomer>;
}

/**
 * The customers other screens name, such as the calendar's, read once each and kept for the selected organization.
 * A failed read other than `CUSTOMER_NOT_FOUND` is forgotten, so the next `want` tries again.
 */
@Injectable({ providedIn: 'root' })
export class CustomerDirectory {
  private readonly api = inject(CustomersApi);
  private readonly tenant = inject(TenantContext);
  private readonly directory = signal<Directory>({ organizationId: null, customers: new Map() });
  private readonly pending = new Set<string>();

  /** The known customers of the selected organization, by id. */
  readonly customers = computed<ReadonlyMap<string, KnownCustomer>>(() => {
    const directory = this.directory();
    return directory.organizationId === this.tenant.organizationId()
      ? directory.customers
      : new Map();
  });

  /** Reads the customers not known yet. */
  want(customerIds: Iterable<string>): void {
    const organizationId = this.tenant.organizationId();
    for (const id of new Set(customerIds)) {
      const key = `${organizationId}/${id}`;
      if (this.customers().has(id) || this.pending.has(key)) continue;
      this.pending.add(key);
      void this.read(organizationId, id).finally(() => this.pending.delete(key));
    }
  }

  /** Keeps customers another read already brought, such as a search or a registration. */
  remember(customers: Iterable<Customer>): void {
    this.keep(
      this.tenant.organizationId(),
      [...customers].map((customer) => [customer.id, customer] as const),
    );
  }

  private async read(organizationId: string | null, id: string): Promise<void> {
    let known: KnownCustomer;
    try {
      known = await firstValueFrom(this.api.get(id));
    } catch (error) {
      if (ApiError.of(error).code !== 'CUSTOMER_NOT_FOUND') return;
      known = 'deleted';
    }
    this.keep(organizationId, [[id, known]]);
  }

  private keep(
    organizationId: string | null,
    entries: Iterable<readonly [string, KnownCustomer]>,
  ): void {
    if (organizationId !== this.tenant.organizationId()) return;
    this.directory.update((directory) => {
      const customers = new Map(
        directory.organizationId === organizationId ? directory.customers : [],
      );
      for (const [id, known] of entries) customers.set(id, known);
      return { organizationId, customers };
    });
  }
}
