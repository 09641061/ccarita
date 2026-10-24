import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import type {
  JoinedOrganization as JoinedOrganizationResource,
  Organization as OrganizationResource,
} from '../../shared/infrastructure/api/pibble.schema';
import { API_BASE_URL } from '../../shared/infrastructure/http/api-base-url';
import { JoinedOrganization } from '../domain/model/joined-organization';
import { Organization } from '../domain/model/organization';
import { toJoinedOrganization, toOrganization } from './organization.assembler';

/** `/api/v1/organizations` (the caller's) and `/api/v1/organization` (the one in `X-Organization-Id`). */
@Injectable({ providedIn: 'root' })
export class OrganizationsApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  listJoined(): Observable<JoinedOrganization[]> {
    return this.http
      .get<JoinedOrganizationResource[]>(`${this.baseUrl}/api/v1/organizations`)
      .pipe(map((resources) => resources.map(toJoinedOrganization)));
  }

  current(): Observable<Organization> {
    return this.http
      .get<OrganizationResource>(`${this.baseUrl}/api/v1/organization`)
      .pipe(map(toOrganization));
  }
}
