import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import type { Customer as CustomerResource } from '../../shared/infrastructure/api/pibble.schema';
import { API_BASE_URL } from '../../shared/infrastructure/http/api-base-url';
import { Customer } from '../domain/model/customer';
import { toCustomer } from './customer.assembler';

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
}
