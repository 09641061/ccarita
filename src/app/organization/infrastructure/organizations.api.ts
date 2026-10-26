import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import type {
  JoinedOrganization as JoinedOrganizationResource,
  Organization as OrganizationResource,
  RenameOrganizationRequest,
} from '../../shared/infrastructure/api/pibble.schema';
import { API_BASE_URL } from '../../shared/infrastructure/http/api-base-url';
import { idempotent } from '../../shared/infrastructure/http/idempotency';
import { JoinedOrganization } from '../domain/model/joined-organization';
import { CreateOrganization, Organization } from '../domain/model/organization';
import {
  toCreateOrganizationRequest,
  toJoinedOrganization,
  toOrganization,
} from './organization.assembler';

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

  /** O1: the organization, its first establishment and the caller as owner, on a trial plan. */
  create(command: CreateOrganization, idempotencyKey: string): Observable<Organization> {
    return this.http
      .post<OrganizationResource>(
        `${this.baseUrl}/api/v1/organizations`,
        toCreateOrganizationRequest(command),
        { context: idempotent(idempotencyKey) },
      )
      .pipe(map(toOrganization));
  }

  /** Owner only, a PUT (O2). @throws ApiError `PLAN_INACTIVE` (O6). */
  rename(name: string): Observable<Organization> {
    const body: RenameOrganizationRequest = { name: name.trim() };
    return this.http
      .put<OrganizationResource>(`${this.baseUrl}/api/v1/organization`, body)
      .pipe(map(toOrganization));
  }
}
