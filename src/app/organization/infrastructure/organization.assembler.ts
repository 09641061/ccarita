import type {
  Establishment as EstablishmentResource,
  JoinedOrganization as JoinedOrganizationResource,
  Organization as OrganizationResource,
} from '../../shared/infrastructure/api/pibble.schema';
import { required } from '../../shared/infrastructure/api/required';
import { Establishment } from '../domain/model/establishment';
import { JoinedOrganization } from '../domain/model/joined-organization';
import { Organization } from '../domain/model/organization';

export function toJoinedOrganization(resource: JoinedOrganizationResource): JoinedOrganization {
  return new JoinedOrganization(
    required(resource.id, 'JoinedOrganization.id'),
    required(resource.name, 'JoinedOrganization.name'),
    new Date(required(resource.planActiveUntil, 'JoinedOrganization.planActiveUntil')),
    required(resource.memberId, 'JoinedOrganization.memberId'),
    required(resource.role, 'JoinedOrganization.role'),
  );
}

export function toOrganization(resource: OrganizationResource): Organization {
  return new Organization(
    required(resource.id, 'Organization.id'),
    required(resource.name, 'Organization.name'),
    required(resource.plan, 'Organization.plan'),
    new Date(required(resource.planActiveUntil, 'Organization.planActiveUntil')),
  );
}

export function toEstablishment(resource: EstablishmentResource): Establishment {
  return new Establishment(
    required(resource.id, 'Establishment.id'),
    required(resource.name, 'Establishment.name'),
    resource.address ?? '',
    required(resource.timeZone, 'Establishment.timeZone'),
    resource.archivedAt ? new Date(resource.archivedAt) : null,
  );
}
