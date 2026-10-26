/** Who wrote a message (W5: `business_app` is the owner on the WhatsApp Business app). */
export type MessageOrigin =
  'customer' | 'assistant' | 'staff' | 'business_app' | 'system' | 'history';

/** What a message holds; anything WhatsApp adds later arrives as `unsupported`. */
export type MessageKind =
  | 'text'
  | 'image'
  | 'audio'
  | 'video'
  | 'document'
  | 'sticker'
  | 'location'
  | 'interactive'
  | 'button'
  | 'reaction'
  | 'template'
  | 'unsupported';

/** W10: an outbound message's delivery, which never moves backwards; inbound messages are `received`. */
export type DeliveryStatus = 'received' | 'pending' | 'sent' | 'delivered' | 'read' | 'failed';

/** Whether the file is on Takodu's disk (07 §4); `removed` after C5 or the retention period. */
export type MediaStatus = 'pending' | 'ready' | 'failed' | 'removed';

/** The choices the assistant offered: up to three buttons, or a list of up to ten rows. */
export interface MessageChoices {
  readonly style: 'buttons' | 'list';
  readonly titles: readonly string[];
}

const MEDIA_KINDS: readonly MessageKind[] = ['image', 'audio', 'video', 'document', 'sticker'];

/** One WhatsApp message of a conversation. */
export class Message {
  constructor(
    readonly id: string,
    readonly conversationId: string,
    readonly direction: 'in' | 'out',
    readonly origin: MessageOrigin,
    readonly kind: MessageKind,
    readonly body: string | null,
    readonly hasMedia: boolean,
    readonly mediaMime: string | null,
    readonly mediaStatus: MediaStatus | null,
    /** The template's name on the WhatsApp account, such as `takodu_reminder`. */
    readonly templateName: string | null,
    readonly status: DeliveryStatus,
    readonly sentByMemberId: string | null,
    readonly choices: MessageChoices | null,
    readonly occurredAt: Date,
  ) {}

  get outbound(): boolean {
    return this.direction === 'out';
  }

  /** A file the customer sent that the media endpoint serves once `ready`. */
  get carriesMedia(): boolean {
    return this.hasMedia && MEDIA_KINDS.includes(this.kind);
  }

  /** W10: Meta refused it after its retries. */
  get failed(): boolean {
    return this.status === 'failed';
  }
}
