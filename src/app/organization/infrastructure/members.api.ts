import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import type { Member as MemberResource } from '../../shared/infrastructure/api/pibble.schema';
import { API_BASE_URL } from '../../shared/infrastructure/http/api-base-url';
import { Member } from '../domain/model/member';
import { toMember } from './organization.assembler';

/** `/api/v1/members` of the selected organization. */
@Injectable({ providedIn: 'root' })
export class MembersApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** Active members and pending invitations, by name; every role may read them. */
  list(): Observable<Member[]> {
    return this.http
      .get<MemberResource[]>(`${this.baseUrl}/api/v1/members`)
      .pipe(map((resources) => resources.map(toMember)));
  }
}
