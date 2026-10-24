import type {
  Customer as CustomerResource,
  CustomerDetailsRequest,
  CustomerPage as CustomerPageResource,
  RegisterCustomerRequest,
} from '../../shared/infrastructure/api/pibble.schema';
import { required } from '../../shared/infrastructure/api/required';
import { RegisterCustomer } from '../domain/model/customer';
import { CustomerDetails } from '../domain/model/customer-details';
import { CustomerPage } from '../domain/model/customer-page';
import { CustomerProfile } from '../domain/model/customer-profile';
import { IdentityDocument, isDocumentType } from '../domain/model/identity-document';

export function toCustomerProfile(resource: CustomerResource): CustomerProfile {
  const phone = required(resource.phone, 'Customer.phone');
  const type = resource.documentType?.toLowerCase();
  const document =
    isDocumentType(type) && resource.documentNumber
      ? new IdentityDocument(type, resource.documentNumber)
      : null;
  return new CustomerProfile(
    required(resource.id, 'Customer.id'),
    phone,
    resource.displayName ?? phone,
    resource.name || null,
    resource.whatsappProfileName || null,
    document,
    resource.notes || null,
  );
}

export function toCustomerPage(resource: CustomerPageResource): CustomerPage {
  return new CustomerPage(
    (resource.items ?? []).map(toCustomerProfile),
    resource.page ?? 0,
    resource.hasMore ?? false,
  );
}

/** Empty texts are left out: on a PUT pibble clears them, on a POST they stay empty. */
export function toCustomerDetailsRequest(
  details: Partial<CustomerDetails>,
): CustomerDetailsRequest {
  const name = details.name?.trim();
  const number = details.documentNumber?.trim();
  const notes = details.notes?.trim();
  return {
    ...(name ? { name } : {}),
    ...(details.documentType || number
      ? { documentType: details.documentType ?? undefined, documentNumber: number || undefined }
      : {}),
    ...(notes ? { notes } : {}),
  };
}

export function toRegisterCustomerRequest(command: RegisterCustomer): RegisterCustomerRequest {
  return {
    phone: command.phone.trim(),
    ...toCustomerDetailsRequest({ ...command, name: command.name ?? '' }),
  };
}
