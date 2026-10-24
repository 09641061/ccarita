import { Injectable, computed, inject, linkedSignal, signal } from '@angular/core';
import { rxResource, toObservable } from '@angular/core/rxjs-interop';
import {
  EMPTY,
  Observable,
  Subject,
  Subscription,
  defer,
  firstValueFrom,
  retry,
  switchMap,
  tap,
  timeout,
  timer,
} from 'rxjs';
import { CurrentEstablishment, CurrentOrganization } from '../../organization/public-api';
import { Conversation } from '../domain/model/conversation';
import { InboxChange } from '../domain/model/inbox-change';
import { ConversationsApi } from '../infrastructure/conversations.api';
import { InboxStreamApi } from '../infrastructure/inbox-stream.api';
import { WhatsappLinesApi } from '../infrastructure/whatsapp-lines.api';

export const INBOX_PAGE_SIZE = 30;
/** pibble pings every 25 seconds; a stream silent for this long is reconnected. */
export const STREAM_SILENCE_MS = 60_000;
const MAX_BACKOFF_MS = 30_000;

/** Filters over the loaded conversations; pibble filters none. */
export type InboxFilter = 'all' | 'needsSomeone' | 'unread' | 'mine';

/** `live` after the stream's first ping; `offline` while it waits to reconnect. */
export type StreamState = 'idle' | 'connecting' | 'live' | 'offline';

interface Loaded {
  readonly items: readonly Conversation[];
  readonly nextCursor: string | null;
}

/** Waits 1, 2, 4… seconds after each failed connection, at most 30. */
export function reconnectDelay(attempt: number): number {
  return Math.min(1000 * 2 ** (attempt - 1), MAX_BACKOFF_MS);
}

/**
 * Bandeja: the selected establishment's conversations, newest activity first (W7), a page at a time, kept current
 * by the inbox stream. A change reloads that conversation; a reconnection reloads the first page, since changes
 * may have been missed meanwhile. The stream runs while a screen follows it, with the selected organization.
 */
@Injectable({ providedIn: 'root' })
export class InboxStore {
  private readonly api = inject(ConversationsApi);
  private readonly streamApi = inject(InboxStreamApi);
  private readonly linesApi = inject(WhatsappLinesApi);
  private readonly establishment = inject(CurrentEstablishment);
  private readonly organization = inject(CurrentOrganization);

  readonly filter = signal<InboxFilter>('all');
  readonly streamState = signal<StreamState>('idle');

  /** Reloads with the establishment, and after the stream reconnects. */
  readonly firstPage = rxResource({
    params: () => this.establishment.id() ?? undefined,
    stream: ({ params }) => this.api.listForEstablishment(params, null, INBOX_PAGE_SIZE),
  });

  /** The establishment's line, connected or the last one; `WHATSAPP_LINE_NOT_FOUND` when it never had one. */
  readonly line = rxResource({
    params: () => this.establishment.id() ?? undefined,
    stream: ({ params }) => this.linesApi.forEstablishment(params),
  });

  private readonly loaded = linkedSignal<Loaded | null>(() =>
    this.firstPage.hasValue() ? this.firstPage.value() : null,
  );
  readonly loadingMore = signal(false);

  readonly conversations = computed<readonly Conversation[] | null>(
    () => this.loaded()?.items ?? null,
  );
  readonly hasMore = computed(() => !!this.loaded()?.nextCursor);
  readonly visible = computed(() => {
    const conversations = this.conversations() ?? [];
    const filter = this.filter();
    return conversations.filter((c) => this.matches(c, filter));
  });
  readonly needingSomeone = computed(
    () => (this.conversations() ?? []).filter((c) => c.needsSomeone).length,
  );

  private readonly changes = new Subject<string>();
  private readonly reconnections = new Subject<void>();
  /** The id of each conversation the stream says changed, in the selected establishment. */
  readonly changed$: Observable<string> = this.changes.asObservable();
  /** After a reconnection: changes may have been missed. */
  readonly reconnected$: Observable<void> = this.reconnections.asObservable();

  private followers = 0;
  private subscription: Subscription | null = null;
  private readonly organizationId$ = toObservable(
    computed(() => this.organization.selected()?.id ?? null),
  );

  /**
   * Starts following the inbox stream, for as long as the returned function is not called. The stream restarts
   * when the organization changes and stops without one.
   */
  follow(): () => void {
    if (this.followers++ === 0) {
      this.subscription = this.organizationId$
        .pipe(switchMap((id) => (id ? this.stream() : EMPTY)))
        .subscribe((change) => this.apply(change));
    }
    let stopped = false;
    return () => {
      if (stopped) return;
      stopped = true;
      if (--this.followers === 0) {
        this.subscription?.unsubscribe();
        this.subscription = null;
        this.streamState.set('idle');
      }
    };
  }

  /** Appends the next page; conversations already loaded are kept once. */
  async loadMore(): Promise<void> {
    const loaded = this.loaded();
    const establishmentId = this.establishment.id();
    if (!loaded?.nextCursor || !establishmentId || this.loadingMore()) return;
    this.loadingMore.set(true);
    try {
      const page = await firstValueFrom(
        this.api.listForEstablishment(establishmentId, loaded.nextCursor, INBOX_PAGE_SIZE),
      );
      this.loaded.update((current) =>
        current
          ? {
              items: merge(current.items, page.items),
              nextCursor: page.nextCursor,
            }
          : current,
      );
    } finally {
      this.loadingMore.set(false);
    }
  }

  /** Puts a conversation pibble returned in its place, newest activity first. */
  upsert(conversation: Conversation): void {
    if (conversation.establishmentId !== this.establishment.id()) return;
    this.loaded.update((current) =>
      current ? { ...current, items: merge(current.items, [conversation]) } : current,
    );
  }

  private stream(): Observable<InboxChange> {
    let dropped = false;
    return defer(() => {
      this.streamState.set(dropped ? 'offline' : 'connecting');
      return this.streamApi.follow();
    }).pipe(
      timeout({ each: STREAM_SILENCE_MS }),
      tap({
        next: (change) => {
          if (change.type !== 'ping' || this.streamState() === 'live') return;
          this.streamState.set('live');
          if (dropped) {
            this.firstPage.reload();
            this.reconnections.next();
          }
        },
        error: () => {
          dropped = true;
          this.streamState.set('offline');
        },
      }),
      retry({ delay: (_, attempt) => timer(reconnectDelay(attempt)), resetOnSuccess: true }),
    );
  }

  private apply(change: InboxChange): void {
    if (change.type !== 'conversation' || change.establishmentId !== this.establishment.id())
      return;
    this.changes.next(change.conversationId);
    this.api.get(change.conversationId).subscribe({
      next: (conversation) => this.upsert(conversation),
      error: () => undefined,
    });
  }

  private matches(conversation: Conversation, filter: InboxFilter): boolean {
    switch (filter) {
      case 'needsSomeone':
        return conversation.needsSomeone;
      case 'unread':
        return conversation.unreadCount > 0;
      case 'mine':
        return (
          conversation.assignedMemberId !== null &&
          conversation.assignedMemberId === this.organization.memberId()
        );
      default:
        return true;
    }
  }
}

/** `updates` replace conversations with the same id; the result is newest activity first. */
function merge(
  items: readonly Conversation[],
  updates: readonly Conversation[],
): readonly Conversation[] {
  const byId = new Map(items.map((c) => [c.id, c]));
  for (const update of updates) byId.set(update.id, update);
  return [...byId.values()].sort((a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime());
}
