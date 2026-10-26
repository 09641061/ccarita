/** Meta's review of a notification template on the line's account (W11–W13). */
export type TemplateStatus = 'pending' | 'approved' | 'rejected' | 'paused' | 'disabled';

/** An establishment's WhatsApp number (W1, W2); pibble returns the last one when it was disconnected. */
export class WhatsappLine {
  constructor(
    readonly id: string,
    readonly establishmentId: string,
    readonly displayPhone: string,
    readonly mode: 'coexistence' | 'cloud_api',
    readonly connected: boolean,
    /** By template (`reminder`, `confirmation`, `cancellation`). */
    readonly templates: Readonly<Record<string, TemplateStatus>>,
  ) {}
}

export type LineMode = WhatsappLine['mode'];

/** What Meta's Embedded Signup hands the browser: a single-use code and the chosen number (W2). */
export interface SignupResult {
  readonly code: string;
  readonly wabaId: string;
  readonly phoneNumberId: string;
}

/** W1, W2: finish connecting a number; coexistence keeps it in the WhatsApp Business app. */
export interface ConnectLine extends SignupResult {
  readonly mode: LineMode;
  /** The 6-digit two-step verification PIN; `cloud_api` only. */
  readonly pin?: string;
}
