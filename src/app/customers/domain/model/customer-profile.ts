import { Customer } from './customer';
import { CustomerDetails } from './customer-details';
import { IdentityDocument } from './identity-document';

/** Everything pibble keeps of a customer: the phone and display name, and what staff typed (C1, C2, C4). */
export class CustomerProfile extends Customer {
  constructor(
    id: string,
    phone: string,
    displayName: string,
    /** The name staff typed, if any. */
    readonly name: string | null,
    /** The latest name the customer uses on WhatsApp (C2). */
    readonly whatsappProfileName: string | null,
    readonly document: IdentityDocument | null,
    readonly notes: string | null,
  ) {
    super(id, phone, displayName);
  }

  /** C2: the WhatsApp name is worth showing apart only when the typed name hides it. */
  get otherWhatsappName(): string | null {
    const whatsapp = this.whatsappProfileName;
    return whatsapp && whatsapp !== this.displayName ? whatsapp : null;
  }

  /** The editable state, to fill a form with. */
  get details(): CustomerDetails {
    return {
      name: this.name ?? '',
      documentType: this.document?.type ?? null,
      documentNumber: this.document?.number ?? '',
      notes: this.notes ?? '',
    };
  }
}
