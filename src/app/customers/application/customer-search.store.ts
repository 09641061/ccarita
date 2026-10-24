import { Injectable, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { firstValueFrom, switchMap, tap, timer } from 'rxjs';
import { TenantContext } from '../../shared/infrastructure/tenancy/tenant-context';
import { Customer, RegisterCustomer } from '../domain/model/customer';
import { CustomersApi } from '../infrastructure/customers.api';
import { CustomerDirectory } from './customer-directory.store';

/** How long typing pauses before a search goes out. */
export const SEARCH_DELAY_MS = 250;
const PAGE_SIZE = 20;

/**
 * Finding a customer by name or phone, and registering one by phone (C1, C3), for screens that pick a customer,
 * such as booking. Results reload with the text and the organization; found customers join `CustomerDirectory`.
 */
@Injectable({ providedIn: 'root' })
export class CustomerSearch {
  private readonly api = inject(CustomersApi);
  private readonly tenant = inject(TenantContext);
  private readonly directory = inject(CustomerDirectory);

  readonly query = signal('');

  /** The first page of active customers matching the text, by display name; every customer when it is empty. */
  readonly results = rxResource({
    params: () => ({ q: this.query().trim(), organizationId: this.tenant.organizationId() }),
    stream: ({ params }) =>
      timer(params.q ? SEARCH_DELAY_MS : 0).pipe(
        switchMap(() => this.api.search(params.q, 0, PAGE_SIZE)),
        tap((page) => this.directory.remember(page.items)),
      ),
  });

  search(query: string): void {
    this.query.set(query);
  }

  /** C1, C3. @throws ApiError `CUSTOMER_CONFLICT` when an active customer has the phone, `VALIDATION_ERROR`. */
  async register(command: RegisterCustomer, idempotencyKey: string): Promise<Customer> {
    const customer = await firstValueFrom(this.api.register(command, idempotencyKey));
    this.directory.remember([customer]);
    return customer;
  }
}
