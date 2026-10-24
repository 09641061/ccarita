/** A person the business serves, identified by their phone (C1). */
export class Customer {
  constructor(
    readonly id: string,
    /** E.164, shown as stored and never logged. */
    readonly phone: string,
    /** C2: the typed name, else the WhatsApp profile name, else the phone; pibble chooses it. */
    readonly displayName: string,
  ) {}
}
