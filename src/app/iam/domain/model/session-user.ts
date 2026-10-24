/** The person signed in: an email, and a name only if they gave one (I1). */
export class SessionUser {
  constructor(
    readonly id: string,
    readonly email: string,
    readonly name: string | null,
  ) {}

  /** The name to show; the email when the user has no name yet (I1). */
  get displayName(): string {
    return this.name?.trim() || this.email;
  }
}
