import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import type {
  OrganizationAccount as OrganizationAccountResource,
  OrganizationAssistantUsage as OrganizationAssistantUsageResource,
} from '../../shared/infrastructure/api/pibble.schema';
import { UsagePeriod } from '../../shared/domain/model/usage-period';
import { API_BASE_URL } from '../../shared/infrastructure/http/api-base-url';
import { OrganizationAccount } from '../domain/model/organization-account';
import { OrganizationUsage } from '../domain/model/organization-usage';
import { toOrganizationAccount, toOrganizationUsage } from './platform.assembler';

/** `/internal/v1/organizations` and an organization's `assistant-usage`, for the Takodu team. */
@Injectable({ providedIn: 'root' })
export class OrganizationAccountsApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** Every organization, the plan ending soonest first. */
  list(): Observable<OrganizationAccount[]> {
    return this.http
      .get<OrganizationAccountResource[]>(`${this.baseUrl}/internal/v1/organizations`)
      .pipe(map((resources) => resources.map(toOrganizationAccount)));
  }

  /** A9: each establishment's turns, tokens and tool calls in its own days. @throws ApiError 404 for no such organization. */
  usage(organizationId: string, period: UsagePeriod): Observable<OrganizationUsage> {
    return this.http
      .get<OrganizationAssistantUsageResource>(
        `${this.baseUrl}/internal/v1/organizations/${organizationId}/assistant-usage`,
        { params: { from: period.from.toString(), to: period.to.toString() } },
      )
      .pipe(map(toOrganizationUsage));
  }
}
