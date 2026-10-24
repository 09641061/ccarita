import { Injectable, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { switchMap, tap, timer } from 'rxjs';
import { TenantContext } from '../../shared/infrastructure/tenancy/tenant-context';
import { CustomersApi } from '../infrastructure/customers.api';
import { CustomerDirectory } from './customer-directory.store';
import { SEARCH_DELAY_MS } from './customer-search.store';

export const LIST_PAGE_SIZE = 20;

interface Position {
  readonly organizationId: string | null;
  readonly page: number;
}

/**
 * The Clientes page: active customers by display name, a page at a time with no total, filtered by name or
 * phone. A new text starts again at the first page once typing pauses; changing the organization does too.
 */
@Injectable({ providedIn: 'root' })
export class CustomerListStore {
  private readonly api = inject(CustomersApi);
  private readonly tenant = inject(TenantContext);
  private readonly directory = inject(CustomerDirectory);
  private readonly position = signal<Position>({ organizationId: null, page: 0 });

  readonly query = signal('');

  /** The page shown, 0 first; it starts over when the organization changes. */
  readonly page = computed(() => {
    const position = this.position();
    return position.organizationId === this.tenant.organizationId() ? position.page : 0;
  });

  readonly results = rxResource({
    params: () => ({
      q: this.query().trim(),
      page: this.page(),
      organizationId: this.tenant.organizationId(),
    }),
    stream: ({ params }) =>
      timer(params.q && params.page === 0 ? SEARCH_DELAY_MS : 0).pipe(
        switchMap(() => this.api.search(params.q, params.page, LIST_PAGE_SIZE)),
        tap((page) => this.directory.remember(page.items)),
      ),
  });

  search(query: string): void {
    this.query.set(query);
    this.goTo(0);
  }

  next(): void {
    const page = this.results.hasValue() ? this.results.value() : null;
    if (page?.hasMore) this.goTo(this.page() + 1);
  }

  previous(): void {
    if (this.page() > 0) this.goTo(this.page() - 1);
  }

  private goTo(page: number): void {
    this.position.set({ organizationId: this.tenant.organizationId(), page });
  }
}
