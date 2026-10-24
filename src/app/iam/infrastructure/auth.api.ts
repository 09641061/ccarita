import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import type {
  RefreshSessionRequest,
  RequestLoginCodeRequest,
  SessionTokens as SessionTokensResource,
  SignInRequest,
} from '../../shared/infrastructure/api/pibble.schema';
import { API_BASE_URL } from '../../shared/infrastructure/http/api-base-url';
import { Session } from '../domain/model/session';
import { anonymous } from './anonymous';
import { toSession } from './session.assembler';

/**
 * `/api/v1/auth` of pibble. Requesting a code, signing in and refreshing take no `Idempotency-Key`:
 * pibble marks them `@WithoutIdempotencyKey` because repeating them is harmless (I2, I3, I5).
 */
@Injectable({ providedIn: 'root' })
export class AuthApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** I2: pibble emails a 6-digit code; `LOGIN_CODE_LIMIT` after five this hour (I3). */
  requestCode(email: string): Observable<void> {
    const body: RequestLoginCodeRequest = { email };
    return this.http.post<void>(`${this.baseUrl}/api/v1/auth/login-codes`, body, {
      context: anonymous(),
    });
  }

  /** @throws ApiError `LOGIN_CODE_INVALID` for a wrong, used or expired code. */
  signIn(email: string, code: string): Observable<Session> {
    const body: SignInRequest = { email, code };
    return this.http
      .post<SessionTokensResource>(`${this.baseUrl}/api/v1/auth/sessions`, body, {
        context: anonymous(),
      })
      .pipe(map(toSession));
  }

  /** I5: new tokens for the refresh token, which pibble rotates. @throws ApiError `REFRESH_TOKEN_INVALID`. */
  refresh(refreshToken: string): Observable<Session> {
    const body: RefreshSessionRequest = { refreshToken };
    return this.http
      .post<SessionTokensResource>(`${this.baseUrl}/api/v1/auth/session-refreshes`, body, {
        context: anonymous(),
      })
      .pipe(map(toSession));
  }

  /** Ends a session; its access tokens stop working within 15 minutes (I5). */
  endSession(sessionId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/api/v1/auth/sessions/${sessionId}`);
  }
}
