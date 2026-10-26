import { Injectable, computed, effect, inject, linkedSignal, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { Conversation } from '../domain/model/conversation';
import { Message } from '../domain/model/message';
import { SendTemplate } from '../domain/model/template-choice';
import { ConversationsApi } from '../infrastructure/conversations.api';
import { MediaApi } from '../infrastructure/media.api';
import { MessagesApi } from '../infrastructure/messages.api';
import { InboxStore } from './inbox.store';

export const CHAT_PAGE_SIZE = 40;

interface Older {
  readonly items: readonly Message[];
  /** `undefined` until an older page was read; then that page's cursor. */
  readonly nextCursor: string | null | undefined;
}

/**
 * One open conversation: its newest messages, older pages on request, and replying (W6, A3). Opening it marks it
 * read (W8); a stream change reloads it and its newest messages, so new messages and delivery statuses appear
 * (W10).
 */
@Injectable({ providedIn: 'root' })
export class ConversationStore {
  private readonly api = inject(ConversationsApi);
  private readonly messagesApi = inject(MessagesApi);
  private readonly mediaApi = inject(MediaApi);
  private readonly inbox = inject(InboxStore);

  readonly openedId = signal<string | null>(null);

  readonly conversation = rxResource({
    params: () => this.openedId() ?? undefined,
    stream: ({ params }) => this.api.get(params),
  });
  /** The newest page; reloaded on every change of the conversation. */
  readonly latest = rxResource({
    params: () => this.openedId() ?? undefined,
    stream: ({ params }) => this.messagesApi.list(params, null, CHAT_PAGE_SIZE),
  });
  private readonly older = linkedSignal<string | null, Older>({
    source: this.openedId,
    computation: () => ({ items: [], nextCursor: undefined }),
  });
  /** Replies sent from this screen, until the newest page includes them. */
  private readonly sent = linkedSignal<string | null, readonly Message[]>({
    source: this.openedId,
    computation: () => [],
  });
  readonly loadingOlder = signal(false);

  /** Oldest first, each message once, in the version read last. */
  readonly messages = computed<readonly Message[] | null>(() => {
    if (!this.latest.hasValue()) return null;
    const byId = new Map<string, Message>();
    for (const m of [...this.older().items, ...this.sent(), ...this.latest.value().items])
      byId.set(m.id, m);
    return [...byId.values()].sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
  });
  readonly hasOlder = computed(() => {
    const older = this.older();
    if (older.nextCursor !== undefined) return older.nextCursor !== null;
    return this.latest.hasValue() && this.latest.value().nextCursor !== null;
  });

  private readonly marking = new Set<string>();

  constructor() {
    this.inbox.changed$.subscribe((id) => {
      if (id !== this.openedId()) return;
      this.conversation.reload();
      this.latest.reload();
    });
    this.inbox.reconnected$.subscribe(() => {
      if (!this.openedId()) return;
      this.conversation.reload();
      this.latest.reload();
    });
    effect(() => {
      const conversation = this.conversation.hasValue() ? this.conversation.value() : undefined;
      if (conversation && conversation.id === this.openedId() && conversation.unreadCount > 0)
        void this.markRead(conversation);
    });
  }

  open(conversationId: string | null): void {
    this.openedId.set(conversationId);
  }

  async loadOlder(): Promise<void> {
    const id = this.openedId();
    const older = this.older();
    const cursor =
      older.nextCursor !== undefined
        ? older.nextCursor
        : this.latest.hasValue()
          ? this.latest.value().nextCursor
          : null;
    if (!id || !cursor || this.loadingOlder()) return;
    this.loadingOlder.set(true);
    try {
      const page = await firstValueFrom(this.messagesApi.list(id, cursor, CHAT_PAGE_SIZE));
      if (this.openedId() === id)
        this.older.set({ items: [...page.items, ...older.items], nextCursor: page.nextCursor });
    } finally {
      this.loadingOlder.set(false);
    }
  }

  /**
   * W6, A3: queues a text reply, which pauses the assistant for 12 hours.
   * @throws ApiError `WINDOW_CLOSED`, `LINE_DISCONNECTED`, `PLAN_INACTIVE`, `VALIDATION_ERROR`.
   */
  async send(body: string, idempotencyKey: string): Promise<Message> {
    const id = this.openedId();
    if (!id) throw new Error('No conversation is open');
    return this.queued(id, await firstValueFrom(this.messagesApi.send(id, body, idempotencyKey)));
  }

  /**
   * W6, W11, W12, A3: queues an upcoming appointment's reminder or confirmation, which reaches the customer
   * outside the window and pauses the assistant for 12 hours.
   * @throws ApiError `TEMPLATE_NOT_APPROVED`, `APPOINTMENT_NOT_UPCOMING`, `LINE_DISCONNECTED`, `CUSTOMER_DELETED`,
   * `PLAN_INACTIVE`.
   */
  async sendTemplate(command: SendTemplate, idempotencyKey: string): Promise<Message> {
    const id = this.openedId();
    if (!id) throw new Error('No conversation is open');
    return this.queued(
      id,
      await firstValueFrom(this.messagesApi.sendTemplate(id, command, idempotencyKey)),
    );
  }

  /** W9: informative; `null` unassigns. @throws ApiError `MEMBER_NOT_AT_ESTABLISHMENT`. */
  async assign(memberId: string | null): Promise<void> {
    const id = this.openedId();
    if (!id) throw new Error('No conversation is open');
    this.applied(await firstValueFrom(this.api.assign(id, memberId)));
  }

  /** A3: keeps the assistant quiet on this chat until someone resumes it; allowed on an inactive plan (O6). */
  async pauseAssistant(idempotencyKey: string): Promise<void> {
    const id = this.openedId();
    if (!id) throw new Error('No conversation is open');
    this.applied(await firstValueFrom(this.api.pauseAssistant(id, idempotencyKey)));
  }

  /** A3, A7: clears the pauses and the handoff; the assistant answers the customer's next message. */
  async resumeAssistant(idempotencyKey: string): Promise<void> {
    const id = this.openedId();
    if (!id) throw new Error('No conversation is open');
    this.applied(await firstValueFrom(this.api.resumeAssistant(id, idempotencyKey)));
  }

  /** A file a customer sent. @throws ApiError `MEDIA_NOT_READY`, `MEDIA_DOWNLOAD_FAILED`, `MEDIA_REMOVED`. */
  media(messageId: string): Promise<Blob> {
    return firstValueFrom(this.mediaApi.download(messageId));
  }

  /** Shows a message queued from this screen until the newest page includes it. */
  private queued(conversationId: string, message: Message): Message {
    if (this.openedId() === conversationId) {
      this.sent.update((sent) => [...sent, message]);
      this.conversation.reload();
    }
    return message;
  }

  /** The conversation pibble returned after a command, here and in the inbox. */
  private applied(conversation: Conversation): void {
    if (this.openedId() === conversation.id) this.conversation.set(conversation);
    this.inbox.upsert(conversation);
  }

  /** W8: shows it read at once; pibble's answer replaces it. A failure leaves the count for the next open. */
  private async markRead(conversation: Conversation): Promise<void> {
    if (this.marking.has(conversation.id)) return;
    this.marking.add(conversation.id);
    this.inbox.upsert(conversation.read());
    try {
      const read = await firstValueFrom(this.api.markRead(conversation.id));
      this.inbox.upsert(read);
      if (this.openedId() === read.id) this.conversation.set(read);
    } catch {
      // The count stays in pibble; the next open or change tries again.
    } finally {
      this.marking.delete(conversation.id);
    }
  }
}
