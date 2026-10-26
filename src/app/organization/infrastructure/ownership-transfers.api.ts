import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import type {
  Member as MemberResource,
  TransferOwnershipRequest,
} from '../../shared/infrastructure/api/pibble.schema';
import { API_BASE_URL } from '../../shared/infrastructure/http/api-base-url';
import { idempotent } from '../../shared/infrastructure/http/idempotency';
import { Member } from '../domain/model/member';
import { toMember } from './organization.assembler';

/** `/api/v1/ownership-transfers`: owner only (03 §5). */
@Injectable({ providedIn: 'root' })
export class OwnershipTransfersApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /**
   * O12: the member becomes owner and the caller a manager, in one step; the answer is the new owner.
   * @throws ApiError `MEMBER_NOT_ACTIVE`, `OWNER_CONFLICT` (a concurrent transfer finished first).
   */
  transfer(newOwnerId: string, idempotencyKey: string): Observable<Member> {
    const body: TransferOwnershipRequest = { newOwnerId };
    return this.http
      .post<MemberResource>(`${this.baseUrl}/api/v1/ownership-transfers`, body, {
        context: idempotent(idempotencyKey),
      })
      .pipe(map(toMember));
  }
}
