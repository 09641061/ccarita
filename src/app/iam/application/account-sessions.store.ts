import { Injectable, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { AccountSession } from '../domain/model/account-session';
import { AuthApi } from '../infrastructure/auth.api';
import { SessionStore } from './session.store';

/** The account screen's devices (I5): listing them and signing one out. */
@Injectable({ providedIn: 'root' })
export class AccountSessionsStore {
  private readonly api = inject(AuthApi);
  private readonly session = inject(SessionStore);

  /** Reloads when another user signs in. */
  readonly sessions = rxResource({
    params: () => this.session.user()?.id,
    stream: () => this.api.listSessions(),
    defaultValue: [],
  });

  /**
   * Signs a device out. This device signs out through `SessionStore.signOut()`, which also forgets its tokens; the
   * others lose access within 15 minutes, when their access token runs out.
   * @throws ApiError `SESSION_NOT_FOUND` when it had already ended.
   */
  async signOut(session: AccountSession): Promise<void> {
    if (session.current) {
      await this.session.signOut();
      return;
    }
    await firstValueFrom(this.api.endSession(session.id), { defaultValue: undefined });
    this.sessions.reload();
  }
}
