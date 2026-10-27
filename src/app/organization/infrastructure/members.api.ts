import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import type { Member as MemberResource } from '../../shared/infrastructure/api/pibble.schema';
import { API_BASE_URL } from '../../shared/infrastructure/http/api-base-url';
import { idempotent } from '../../shared/infrastructure/http/idempotency';
import { InviteMember, Member, UpdateMember } from '../domain/model/member';
import { toInviteMemberRequest, toMember, toUpdateMemberRequest } from './organization.assembler';

/** `/api/v1/members` of the selected organization. Writes are for owners and managers (03 §5), also with an inactive plan (O6). */
@Injectable({ providedIn: 'root' })
export class MembersApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** Active members and pending invitations, by name; every role may read them. */
  list(): Observable<Member[]> {
    return this.http
      .get<MemberResource[]>(this.url())
      .pipe(map((resources) => resources.map(toMember)));
  }

  /**
   * O10: emails a link valid 7 days.
   * @throws ApiError `MEMBER_CONFLICT` (already a member or invited, O11), `ESTABLISHMENT_NOT_FOUND`.
   */
  invite(command: InviteMember, idempotencyKey: string): Observable<Member> {
    return this.http
      .post<MemberResource>(this.url(), toInviteMemberRequest(command), {
        context: idempotent(idempotencyKey),
      })
      .pipe(map(toMember));
  }

  /** A PUT of the whole member. @throws ApiError `OWNER_CHANGE_NOT_ALLOWED` (O12), `MEMBER_NOT_FOUND`. */
  update(memberId: string, command: UpdateMember): Observable<Member> {
    return this.http
      .put<MemberResource>(this.url(memberId), toUpdateMemberRequest(command))
      .pipe(map(toMember));
  }

  /** `PUT /api/v1/members/me`: any role renames their own membership, in this organization only. */
  renameMe(displayName: string): Observable<Member> {
    return this.http
      .put<MemberResource>(this.url('me'), { displayName: displayName.trim() })
      .pipe(map(toMember));
  }

  /**
   * Removes a member or revokes an invitation; history is kept.
   * @throws ApiError `MEMBER_HAS_UPCOMING_APPOINTMENTS`, `OWNER_CHANGE_NOT_ALLOWED` (O12).
   */
  remove(memberId: string): Observable<void> {
    return this.http.delete<void>(this.url(memberId));
  }

  /** O10: a new link valid 7 more days; the old one stops working. @throws ApiError `INVITATION_NOT_PENDING`. */
  renewInvitation(memberId: string, idempotencyKey: string): Observable<Member> {
    return this.http
      .post<MemberResource>(`${this.url(memberId)}/invitation-renewals`, null, {
        context: idempotent(idempotencyKey),
      })
      .pipe(map(toMember));
  }

  private url(memberId?: string): string {
    const base = `${this.baseUrl}/api/v1/members`;
    return memberId ? `${base}/${memberId}` : base;
  }
}
