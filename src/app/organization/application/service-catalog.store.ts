import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Service } from '../domain/model/service';
import { ServiceDetails } from '../domain/model/service-details';
import { ServicesApi } from '../infrastructure/services.api';
import { EstablishmentTeam } from './establishment-team.store';

/**
 * Creating and changing the selected establishment's services (O14, O15), for owners and managers with an active
 * plan. Every change reloads `EstablishmentTeam.services`, which the list, the calendar and booking read.
 */
@Injectable({ providedIn: 'root' })
export class ServiceCatalog {
  private readonly api = inject(ServicesApi);
  private readonly team = inject(EstablishmentTeam);

  /** @throws ApiError `PERFORMER_NOT_ELIGIBLE`, `PLAN_INACTIVE`, `ESTABLISHMENT_ARCHIVED`. */
  async create(
    establishmentId: string,
    details: ServiceDetails,
    idempotencyKey: string,
  ): Promise<Service> {
    return this.changed(this.api.create(establishmentId, details, idempotencyKey));
  }

  /** @throws ApiError `PERFORMER_NOT_ELIGIBLE`, `SERVICE_NOT_FOUND`, `PLAN_INACTIVE`. */
  async update(serviceId: string, details: ServiceDetails): Promise<Service> {
    return this.changed(this.api.update(serviceId, details));
  }

  /** O14: a deactivated service takes no new appointments. @throws ApiError `PLAN_INACTIVE`. */
  async setActive(serviceId: string, active: boolean): Promise<Service> {
    return this.changed(this.api.setActive(serviceId, active));
  }

  private async changed(call: ReturnType<ServicesApi['update']>): Promise<Service> {
    const service = await firstValueFrom(call);
    this.team.services.reload();
    return service;
  }
}
