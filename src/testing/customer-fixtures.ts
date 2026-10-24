import { CustomerProfile } from '../app/customers/domain/model/customer-profile';
import { IdentityDocument } from '../app/customers/domain/model/identity-document';

/** Customers for customers tests. */
export const ROSA = new CustomerProfile(
  'c-1',
  '+51987654321',
  'Rosa Huamán',
  'Rosa Huamán',
  'Rosita H.',
  new IdentityDocument('dni', '45678912'),
  'Prefiere atenderse con Luis.',
);

export const NAMELESS = new CustomerProfile(
  'c-2',
  '+51912345678',
  '+51912345678',
  null,
  null,
  null,
  null,
);
