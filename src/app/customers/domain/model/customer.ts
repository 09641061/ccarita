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

/** C1, C3: only the phone is needed; a Peruvian mobile may leave out +51, and pibble stores it as E.164. */
export interface RegisterCustomer {
  readonly phone: string;
  readonly name: string | null;
}
