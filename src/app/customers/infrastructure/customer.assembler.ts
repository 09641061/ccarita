import type {
  Customer as CustomerResource,
  CustomerPage as CustomerPageResource,
  RegisterCustomerRequest,
} from '../../shared/infrastructure/api/pibble.schema';
import { required } from '../../shared/infrastructure/api/required';
import { Customer, RegisterCustomer } from '../domain/model/customer';
import { CustomerPage } from '../domain/model/customer-page';

export function toCustomer(resource: CustomerResource): Customer {
  const phone = required(resource.phone, 'Customer.phone');
  return new Customer(required(resource.id, 'Customer.id'), phone, resource.displayName ?? phone);
}

export function toCustomerPage(resource: CustomerPageResource): CustomerPage {
  return new CustomerPage(
    (resource.items ?? []).map(toCustomer),
    resource.page ?? 0,
    resource.hasMore ?? false,
  );
}

export function toRegisterCustomerRequest(command: RegisterCustomer): RegisterCustomerRequest {
  const name = command.name?.trim();
  return { phone: command.phone.trim(), ...(name ? { name } : {}) };
}
