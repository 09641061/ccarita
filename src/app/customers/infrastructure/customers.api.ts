import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import type {
  Customer as CustomerResource,
  CustomerPage as CustomerPageResource,
} from '../../shared/infrastructure/api/pibble.schema';
import { API_BASE_URL } from '../../shared/infrastructure/http/api-base-url';
import { idempotent } from '../../shared/infrastructure/http/idempotency';
import { Customer, RegisterCustomer } from '../domain/model/customer';
import { CustomerPage } from '../domain/model/customer-page';
import { toCustomer, toCustomerPage, toRegisterCustomerRequest } from './customer.assembler';

/** `/api/v1/customers` of the selected organization. */
@Injectable({ providedIn: 'root' })
export class CustomersApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** @throws ApiError `CUSTOMER_NOT_FOUND` when deleted (C5) or in another organization. */
  get(customerId: string): Observable<Customer> {
    return this.http
      .get<CustomerResource>(`${this.baseUrl}/api/v1/customers/${customerId}`)
      .pipe(map(toCustomer));
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
  register(command: RegisterCustomer, idempotencyKey: string): Observable<Customer> {
    return this.http
      .post<CustomerResource>(
        `${this.baseUrl}/api/v1/customers`,
        toRegisterCustomerRequest(command),
        { context: idempotent(idempotencyKey) },
      )
      .pipe(map(toCustomer));
  }
}
