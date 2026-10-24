import type {
  Establishment as EstablishmentResource,
  JoinedOrganization as JoinedOrganizationResource,
  Member as MemberResource,
  Organization as OrganizationResource,
  Service as ServiceResource,
} from '../../shared/infrastructure/api/pibble.schema';
import { Money } from '../../shared/domain/model/money';
import { required } from '../../shared/infrastructure/api/required';
import { Establishment } from '../domain/model/establishment';
import { JoinedOrganization } from '../domain/model/joined-organization';
import { Member } from '../domain/model/member';
import { Organization } from '../domain/model/organization';
import { Service } from '../domain/model/service';

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

export function toMember(resource: MemberResource): Member {
  const email = required(resource.email, 'Member.email');
  return new Member(
    required(resource.id, 'Member.id'),
    email,
    resource.displayName || email,
    required(resource.role, 'Member.role'),
    resource.bookable ?? false,
    required(resource.status, 'Member.status'),
    resource.establishmentIds ?? [],
  );
}

export function toService(resource: ServiceResource): Service {
  return new Service(
    required(resource.id, 'Service.id'),
    required(resource.establishmentId, 'Service.establishmentId'),
    required(resource.name, 'Service.name'),
    required(resource.durationMinutes, 'Service.durationMinutes'),
    new Money(required(resource.priceCents, 'Service.priceCents'), resource.currency ?? 'PEN'),
    resource.active ?? true,
    resource.performerIds ?? [],
  );
}
