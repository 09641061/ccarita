import { Injectable, computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { of } from 'rxjs';
import { Member } from '../domain/model/member';
import { Service } from '../domain/model/service';
import { MembersApi } from '../infrastructure/members.api';
import { ServicesApi } from '../infrastructure/services.api';
import { CurrentEstablishment } from './current-establishment.store';
import { CurrentOrganization } from './current-organization.store';

/**
 * The members and services of the selected establishment, which the calendar and booking name and filter by.
 * Members reload with the organization, services with the establishment.
 */
@Injectable({ providedIn: 'root' })
export class EstablishmentTeam {
  private readonly membersApi = inject(MembersApi);
  private readonly servicesApi = inject(ServicesApi);
  private readonly organization = inject(CurrentOrganization);
  private readonly establishment = inject(CurrentEstablishment);

  readonly members = rxResource({
    params: () => this.organization.selected()?.id,
    stream: () => this.membersApi.list(),
    defaultValue: [],
  });

  readonly services = rxResource({
    params: () => this.establishment.id(),
    stream: ({ params }) =>
      params ? this.servicesApi.listForEstablishment(params) : of<Service[]>([]),
    defaultValue: [],
  });

  /** O13, O15: the members who take appointments at the selected establishment, in pibble's order. */
  readonly bookable = computed<readonly Member[]>(() => {
    const establishmentId = this.establishment.id();
    if (!establishmentId) return [];
    return this.members.value().filter((member) => member.takesAppointmentsAt(establishmentId));
  });

  /** Every member and service by id, for naming appointments of members who left or services turned off. */
  readonly membersById = computed(
    () => new Map(this.members.value().map((member) => [member.id, member])),
  );
  readonly servicesById = computed(
    () => new Map(this.services.value().map((service) => [service.id, service])),
  );
}
