/** A device where the user is signed in (I5), as the account screen lists it. */
export class AccountSession {
  constructor(
    readonly id: string,
    readonly lastUsedAt: Date,
    /** When its refresh token runs out unless it is used again. */
    readonly expiresAt: Date,
    /** The device reading the list. */
    readonly current: boolean,
  ) {}
}
