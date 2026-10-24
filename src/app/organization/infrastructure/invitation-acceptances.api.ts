import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import type {
  AcceptInvitationRequest,
  JoinedOrganization as JoinedOrganizationResource,
} from '../../shared/infrastructure/api/pibble.schema';
import { API_BASE_URL } from '../../shared/infrastructure/http/api-base-url';
import { JoinedOrganization } from '../domain/model/joined-organization';
import { toJoinedOrganization } from './organization.assembler';

/** `/api/v1/invitation-acceptances`; no `Idempotency-Key`, as accepting twice returns the same membership. */
@Injectable({ providedIn: 'root' })
export class InvitationAcceptancesApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /**
   * O10: joins the organization of the invitation.
   * @throws ApiError `INVITATION_EXPIRED`, `INVITATION_NOT_FOUND`, `INVITATION_CONFLICT`, or `ACCESS_DENIED` when
   *   the user signed in with another email.
   */
  accept(token: string): Observable<JoinedOrganization> {
    const body: AcceptInvitationRequest = { token };
    return this.http
      .post<JoinedOrganizationResource>(`${this.baseUrl}/api/v1/invitation-acceptances`, body)
      .pipe(map(toJoinedOrganization));
  }
}
