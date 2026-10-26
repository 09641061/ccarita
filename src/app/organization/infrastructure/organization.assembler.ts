import type {
  CreateOrganizationRequest,
  EstablishmentDetailsRequest,
  Establishment as EstablishmentResource,
  InviteMemberRequest,
  OpeningHours as OpeningHoursResource,
  ServiceDetailsRequest,
  JoinedOrganization as JoinedOrganizationResource,
  Member as MemberResource,
  Organization as OrganizationResource,
  Service as ServiceResource,
  UpdateMemberRequest,
} from '../../shared/infrastructure/api/pibble.schema';
import { Money } from '../../shared/domain/model/money';
import { required } from '../../shared/infrastructure/api/required';
import { Establishment, EstablishmentDetails } from '../domain/model/establishment';
import { JoinedOrganization } from '../domain/model/joined-organization';
import { InviteMember, Member, UpdateMember } from '../domain/model/member';
import { IsoWeekday, OpeningHours } from '../domain/model/opening-hours';
import { CreateOrganization, Organization } from '../domain/model/organization';
import { Service } from '../domain/model/service';
import { ServiceDetails } from '../domain/model/service-details';

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
    resource.joinedAt ? new Date(resource.joinedAt) : null,
    resource.inviteExpiresAt ? new Date(resource.inviteExpiresAt) : null,
  );
}

/** Managers get no establishments: pibble ignores them (O13). */
export function toInviteMemberRequest(command: InviteMember): InviteMemberRequest {
  return {
    email: command.email.trim(),
    displayName: command.displayName.trim(),
    role: command.role,
    bookable: command.bookable,
    establishmentIds: command.role === 'staff' ? [...command.establishmentIds] : [],
  };
}

export function toUpdateMemberRequest(command: UpdateMember): UpdateMemberRequest {
  return {
    displayName: command.displayName.trim(),
    bookable: command.bookable,
    role: command.role,
    establishmentIds: command.role === 'staff' ? [...command.establishmentIds] : [],
  };
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
    resource.instructions ?? '',
  );
}

export function toCreateOrganizationRequest(
  command: CreateOrganization,
): CreateOrganizationRequest {
  return {
    name: command.name.trim(),
    establishmentName: command.establishment.name.trim(),
    ...optional('address', command.establishment.address),
    ...optional('timeZone', command.establishment.timeZone),
    ownerDisplayName: command.ownerDisplayName.trim(),
  };
}

/** A blank address or time zone is left out: pibble then keeps none, and America/Lima (O7). */
export function toEstablishmentDetailsRequest(
  details: EstablishmentDetails,
): EstablishmentDetailsRequest {
  return {
    name: details.name.trim(),
    ...optional('address', details.address),
    ...optional('timeZone', details.timeZone),
  };
}

export function toOpeningHours(resource: OpeningHoursResource): OpeningHours {
  return new OpeningHours(
    required(resource.ranges, 'OpeningHours.ranges').map((range) => ({
      weekday: required(range.weekday, 'OpeningRange.weekday') as IsoWeekday,
      opensAt: required(range.opensAt, 'OpeningRange.opensAt').slice(0, 5),
      closesAt: required(range.closesAt, 'OpeningRange.closesAt').slice(0, 5),
    })),
  );
}

export function toOpeningHoursResource(hours: OpeningHours): OpeningHoursResource {
  return { ranges: hours.ranges.map((range) => ({ ...range })) };
}

export function toServiceDetailsRequest(details: ServiceDetails): ServiceDetailsRequest {
  return {
    name: details.name.trim(),
    durationMinutes: details.durationMinutes,
    priceCents: details.priceCents,
    ...optional('instructions', details.instructions),
    performerIds: [...details.performerIds],
  };
}

function optional<K extends string>(key: K, value: string): Partial<Record<K, string>> {
  const trimmed = value.trim();
  return trimmed ? ({ [key]: trimmed } as Record<K, string>) : {};
}
