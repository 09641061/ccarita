import { SessionUser } from './session-user';

/** Margin before the access token's expiry at which it is refreshed instead of sent. */
const EXPIRY_MARGIN_MS = 30_000;

/**
 * A signed-in device (I5): a short-lived access token (15 minutes) sent as `Bearer`, and a refresh
 * token (30 days) that pibble rotates on every use.
 */
export class Session {
  constructor(
    readonly id: string,
    readonly user: SessionUser,
    readonly accessToken: string,
    readonly accessTokenExpiresAt: Date,
    readonly refreshToken: string,
  ) {}

  /** I5: the access token is refreshed shortly before its 15 minutes run out. */
  accessTokenExpired(now: Date): boolean {
    return now.getTime() >= this.accessTokenExpiresAt.getTime() - EXPIRY_MARGIN_MS;
  }
}
