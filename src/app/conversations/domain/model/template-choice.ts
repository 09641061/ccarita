import { Conversation } from './conversation';
import { TemplateStatus, WhatsappLine } from './whatsapp-line';

/** The appointment notifications staff may send by hand (W11, W12); cancellations go only from booking (W13). */
export type AppointmentTemplate = 'reminder' | 'confirmation';

export const APPOINTMENT_TEMPLATES: readonly AppointmentTemplate[] = ['reminder', 'confirmation'];

/** Send one appointment's reminder or confirmation to the customer of a conversation. */
export interface SendTemplate {
  readonly template: AppointmentTemplate;
  readonly appointmentId: string;
}

/** How one template would go now, and whether it can. */
export interface TemplateChoice {
  readonly template: AppointmentTemplate;
  /** Meta's review on the line; `null` while the line is unknown or has no entry for it. */
  readonly status: TemplateStatus | null;
  /** W6: a reminder always, and a confirmation outside the window, go as the approved template. */
  readonly asTemplate: boolean;
  /** Only approved templates are sent; text inside the window needs no approval. pibble still decides. */
  readonly sendable: boolean;
}

/** W6, W11–W13: the choices the composer offers, in a fixed order. */
export function templateChoices(
  conversation: Conversation,
  line: WhatsappLine | null,
  now: Date,
): readonly TemplateChoice[] {
  const windowOpen = conversation.windowOpen(now);
  return APPOINTMENT_TEMPLATES.map((template) => {
    const status = line?.templates[template] ?? null;
    const asTemplate = template === 'reminder' || !windowOpen;
    return { template, status, asTemplate, sendable: !asTemplate || status === 'approved' };
  });
}
