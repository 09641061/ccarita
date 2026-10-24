import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import type {
  Customer as CustomerResource,
  CustomerPage as CustomerPageResource,
} from '../../shared/infrastructure/api/pibble.schema';
import { API_BASE_URL } from '../../shared/infrastructure/http/api-base-url';
import { idempotent } from '../../shared/infrastructure/http/idempotency';
import { RegisterCustomer } from '../domain/model/customer';
import { CustomerDetails } from '../domain/model/customer-details';
import { CustomerPage } from '../domain/model/customer-page';
import { CustomerProfile } from '../domain/model/customer-profile';
import {
  toCustomerDetailsRequest,
  toCustomerPage,
  toCustomerProfile,
  toRegisterCustomerRequest,
} from './customer.assembler';

/** `/api/v1/customers` of the selected organization. */
@Injectable({ providedIn: 'root' })
export class CustomersApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** @throws ApiError `CUSTOMER_NOT_FOUND` when deleted (C5) or in another organization. */
  get(customerId: string): Observable<CustomerProfile> {
    return this.http
      .get<CustomerResource>(`${this.baseUrl}/api/v1/customers/${customerId}`)
      .pipe(map(toCustomerProfile));
  }

  /** Active customers by display name, a page at a time; digits in `query` also match the phone. */
  search(query: string, page: number, size: number): Observable<CustomerPage> {
    return this.http
      .get<CustomerPageResource>(`${this.baseUrl}/api/v1/customers`, {
        params: { ...(query ? { q: query } : {}), page, size },
      })
      .pipe(map(toCustomerPage));
  }

  /** C1, C3: any member, also on an inactive plan. @throws ApiError `CUSTOMER_CONFLICT`, `VALIDATION_ERROR`. */
  register(command: RegisterCustomer, idempotencyKey: string): Observable<CustomerProfile> {
    return this.http
      .post<CustomerResource>(
        `${this.baseUrl}/api/v1/customers`,
        toRegisterCustomerRequest(command),
        { context: idempotent(idempotencyKey) },
      )
      .pipe(map(toCustomerProfile));
  }

  /**
   * C4: replaces what staff typed; the phone never changes (C1). pibble clears what the body leaves out.
   * @throws ApiError `VALIDATION_ERROR` (a document of the wrong format, or half a document), `CUSTOMER_NOT_FOUND`.
   */
  update(customerId: string, details: CustomerDetails): Observable<CustomerProfile> {
    return this.http
      .put<CustomerResource>(
        `${this.baseUrl}/api/v1/customers/${customerId}`,
        toCustomerDetailsRequest(details),
      )
      .pipe(map(toCustomerProfile));
  }

  /** C3, C5: owner or manager; a soft delete. @throws ApiError `ACCESS_DENIED`, `CUSTOMER_NOT_FOUND`. */
  delete(customerId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/api/v1/customers/${customerId}`);
  }
}
