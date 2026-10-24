/** A place where the business serves customers, with its own calendar, line and time zone (O13). */
export class Establishment {
  constructor(
    readonly id: string,
    readonly name: string,
    readonly address: string,
    /** IANA name such as `America/Lima`; every time of this establishment is shown in it. */
    readonly timeZone: string,
    readonly archivedAt: Date | null,
  ) {}

  get archived(): boolean {
    return this.archivedAt !== null;
  }
}
