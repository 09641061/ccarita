import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiError } from '../../shared/domain/model/api-error';
import { TenantContext } from '../../shared/infrastructure/tenancy/tenant-context';
import { Session } from '../domain/model/session';
import { AuthApi } from './auth.api';

const STORAGE_KEY = 'ccarita.refreshToken';

/**
 * The session of this browser ([decision](docs/decisions/implemented/2026-10-23-session-tokens-in-the-browser.md)):
 * the access token only in memory, the refresh token in `localStorage` under one key. One refresh runs at a time;
 * callers that need a token meanwhile wait for it. A refused refresh clears the session and the tenant selection.
 */
@Injectable({ providedIn: 'root' })
export class SessionHolder {
  private readonly api = inject(AuthApi);
  private readonly tenant = inject(TenantContext);
  private readonly current = signal<Session | null>(null);
  private refreshing: Promise<string | null> | null = null;

  readonly session = this.current.asReadonly();

  /** A refresh token is stored, so a refresh may restore the session after a reload. */
  get canResume(): boolean {
    return readRefreshToken() !== null;
  }

  start(session: Session): void {
    this.current.set(session);
    writeRefreshToken(session.refreshToken);
  }

  /**
   * The access token to send now: the current one while valid, otherwise the result of a refresh (shared with any
   * refresh in flight). `null` when there is no session.
   */
  async accessToken(): Promise<string | null> {
    if (this.refreshing) return this.refreshing;
    const session = this.current();
    if (session && !session.accessTokenExpired(new Date())) return session.accessToken;
    return this.canResume ? this.refresh() : null;
  }

  /**
   * A new access token after pibble rejected `rejected`. When another call already refreshed past it, that token is
   * returned without a second refresh.
   */
  async renewAfter(rejected: string): Promise<string | null> {
    if (this.refreshing) return this.refreshing;
    const session = this.current();
    if (session && session.accessToken !== rejected) return session.accessToken;
    return this.refresh();
  }

  /**
   * Exchanges the stored refresh token, once at a time. `REFRESH_TOKEN_INVALID` or any other 401 clears the session
   * and resolves `null`; a network failure keeps it and rejects, so the user can retry.
   */
  refresh(): Promise<string | null> {
    this.refreshing ??= this.exchange().finally(() => (this.refreshing = null));
    return this.refreshing;
  }

  /** Forgets the tokens and the selected organization (sign-out or a refused refresh). */
  clear(): void {
    this.current.set(null);
    writeRefreshToken(null);
    this.tenant.clear();
  }

  private async exchange(): Promise<string | null> {
    const refreshToken = readRefreshToken();
    if (!refreshToken) {
      this.clear();
      return null;
    }
    try {
      const session = await firstValueFrom(this.api.refresh(refreshToken));
      this.start(session);
      return session.accessToken;
    } catch (error) {
      if (ApiError.of(error).status === 401) {
        this.clear();
        return null;
      }
      throw error;
    }
  }
}

function readRefreshToken(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeRefreshToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(STORAGE_KEY, token);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage can be unavailable (private mode); the session then lasts while the tab is open.
  }
}
