import { Injectable, computed, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiError } from '../../shared/domain/model/api-error';
import { SessionUser } from '../domain/model/session-user';
import { AuthApi } from '../infrastructure/auth.api';
import { SessionHolder } from '../infrastructure/session-holder';

/** Who is signed in on this browser, and the sign-in and sign-out use cases (I1–I5). */
@Injectable({ providedIn: 'root' })
export class SessionStore {
  private readonly api = inject(AuthApi);
  private readonly holder = inject(SessionHolder);

  readonly user = computed<SessionUser | null>(() => this.holder.session()?.user ?? null);
  readonly isSignedIn = computed(() => this.holder.session() !== null);

  /** A refresh token is stored: the session can come back without a new code. */
  get canResume(): boolean {
    return this.holder.canResume;
  }

  /** @throws ApiError `LOGIN_CODE_LIMIT` after five codes this hour (I3). */
  async requestCode(email: string): Promise<void> {
    await firstValueFrom(this.api.requestCode(email), { defaultValue: undefined });
  }

  /** @throws ApiError `LOGIN_CODE_INVALID` for a wrong, used or expired code (I2). */
  async signIn(email: string, code: string): Promise<void> {
    this.holder.start(await firstValueFrom(this.api.signIn(email, code)));
  }

  /**
   * Signed in already, or signed in again with the stored refresh token. Resolves `false` when there is none or
   * pibble refused it.
   * @throws ApiError `NETWORK_ERROR` when pibble cannot be reached; the stored token is kept for a retry.
   */
  async restore(): Promise<boolean> {
    if (this.isSignedIn()) return true;
    if (!this.holder.canResume) return false;
    return (await this.holder.refresh()) !== null;
  }

  /**
   * Ends this session in pibble and forgets the tokens and the selected organization. The local session ends even
   * when pibble cannot be reached; the refresh token is gone, and the access token expires within 15 minutes.
   */
  async signOut(): Promise<void> {
    const session = this.holder.session();
    if (session) {
      try {
        await firstValueFrom(this.api.endSession(session.id), { defaultValue: undefined });
      } catch (error) {
        if (!(error instanceof ApiError)) throw error;
      }
    }
    this.holder.clear();
  }
}
