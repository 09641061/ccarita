import type { Customer as CustomerResource } from '../../shared/infrastructure/api/pibble.schema';
import { required } from '../../shared/infrastructure/api/required';
import { Customer } from '../domain/model/customer';

export function toCustomer(resource: CustomerResource): Customer {
  const phone = required(resource.phone, 'Customer.phone');
  return new Customer(required(resource.id, 'Customer.id'), phone, resource.displayName ?? phone);
}
