import { Injectable, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { ApiError } from '../../shared/domain/model/api-error';
import { RegisterCustomer } from '../domain/model/customer';
import { CustomerDetails } from '../domain/model/customer-details';
import { CustomerProfile } from '../domain/model/customer-profile';
import { CustomersApi } from '../infrastructure/customers.api';
import { CustomerDirectory } from './customer-directory.store';
import { CustomerListStore } from './customer-list.store';

/**
 * One customer of the Clientes page: reading, registering, editing and deleting (C1–C5). Every role may register
 * and edit, also on an inactive plan; only owners and managers delete, which pibble enforces. Each change reloads
 * the list and updates `CustomerDirectory`, so other screens name the customer right.
 */
@Injectable({ providedIn: 'root' })
export class CustomerDetailStore {
  private readonly api = inject(CustomersApi);
  private readonly directory = inject(CustomerDirectory);
  private readonly list = inject(CustomerListStore);

  readonly openedId = signal<string | null>(null);
  readonly profile = rxResource({
    params: () => this.openedId() ?? undefined,
    stream: ({ params }) => this.api.get(params),
  });

  open(customerId: string | null): void {
    this.openedId.set(customerId);
  }

  /** C1, C3. @throws ApiError `CUSTOMER_CONFLICT` when an active customer has the phone, `VALIDATION_ERROR`. */
  async register(command: RegisterCustomer, idempotencyKey: string): Promise<CustomerProfile> {
    const profile = await firstValueFrom(this.api.register(command, idempotencyKey));
    this.changed(profile);
    return profile;
  }

  /** C4: sends the whole form. @throws ApiError `VALIDATION_ERROR`, `CUSTOMER_NOT_FOUND`. */
  async update(customerId: string, details: CustomerDetails): Promise<CustomerProfile> {
    const profile = await firstValueFrom(this.api.update(customerId, details));
    this.changed(profile);
    return profile;
  }

  /**
   * C5: a soft delete; a customer someone else already deleted counts as deleted.
   * @throws ApiError `ACCESS_DENIED` for staff.
   */
  async delete(customerId: string): Promise<void> {
    try {
      await firstValueFrom(this.api.delete(customerId), { defaultValue: undefined });
    } catch (error) {
      if (ApiError.of(error).code !== 'CUSTOMER_NOT_FOUND') throw error;
    }
    this.directory.forget(customerId);
    if (this.openedId() === customerId) this.openedId.set(null);
    this.list.results.reload();
  }

  private changed(profile: CustomerProfile): void {
    this.directory.remember([profile]);
    if (this.openedId() === profile.id) this.profile.set(profile);
    this.list.results.reload();
  }
}
