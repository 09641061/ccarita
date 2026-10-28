/** What a conversation shows in the list, as the stream sends it after each change (W6, W8, A3, A7). */
export interface ConversationSummary {
  readonly lastMessageAt: Date;
  readonly lastInboundAt: Date | null;
  readonly unreadCount: number;
  /** W6: `null` before the customer ever wrote. */
  readonly windowClosesAt: Date | null;
  readonly assistantPausedUntil: Date | null;
  readonly assistantHandedOff: boolean;
  readonly assistantPausedManually: boolean;
}

export type AppointmentChange = 'booked' | 'rescheduled' | 'cancelled';

/**
 * An event of the inbox stream for the establishments the member sees (W7): `ping` once subscribed and every 25
 * seconds; `conversation` when one changed, with its summary; `assistant` when the assistant starts (`typing`) or
 * stops answering one; `appointment` when booking committed a change.
 */
export type InboxChange =
  | { readonly type: 'ping' }
  | {
      readonly type: 'conversation';
      readonly conversationId: string;
      readonly establishmentId: string;
      /** `null` when pibble sent none. */
      readonly summary: ConversationSummary | null;
    }
  | {
      readonly type: 'assistant';
      readonly conversationId: string;
      readonly establishmentId: string;
      readonly typing: boolean;
    }
  | {
      readonly type: 'appointment';
      readonly appointmentId: string;
      readonly establishmentId: string;
      readonly change: AppointmentChange;
    };
