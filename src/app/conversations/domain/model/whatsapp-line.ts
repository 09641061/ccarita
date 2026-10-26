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
