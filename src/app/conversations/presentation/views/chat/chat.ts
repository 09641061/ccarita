import { CdkTextareaAutosize } from '@angular/cdk/text-field';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterRenderEffect,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { FormField, form, maxLength } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import {
  CurrentEstablishment,
  CurrentOrganization,
  EstablishmentTeam,
} from '../../../../organization/public-api';
import { ApiError } from '../../../../shared/domain/model/api-error';
import { newIdempotencyKey } from '../../../../shared/domain/model/idempotency-key';
import { LocalDate } from '../../../../shared/domain/model/local-date';
import { Avatar } from '../../../../shared/presentation/components/avatar/avatar';
import { BusyButton } from '../../../../shared/presentation/components/busy-button/busy-button';
import { Skeleton } from '../../../../shared/presentation/components/skeleton/skeleton';
import {
  StateKind,
  StateView,
} from '../../../../shared/presentation/components/state-view/state-view';
import { ErrorMessagePipe } from '../../../../shared/presentation/pipes/error-message.pipe';
import { ZonedDatePipe } from '../../../../shared/presentation/pipes/zoned-date.pipe';
import { ConversationStore } from '../../../application/conversation.store';
import { InboxStore } from '../../../application/inbox.store';
import { Message } from '../../../domain/model/message';
import { MessageBubble } from '../../components/message-bubble/message-bubble';
import { conversationStatus } from '../../conversation-status';
import { memberNames } from '../../member-names';
import { MessageMedia } from '../message-media/message-media';

/** pibble's limit on a reply (`SendMessageRequest.body`). */
export const REPLY_MAX_LENGTH = 4096;

interface Day {
  readonly day: LocalDate;
  readonly messages: readonly Message[];
}

/** Why the composer is closed, first match wins: C5, O6, W1, W6. */
export type ReplyBlock = 'customerDeleted' | 'planInactive' | 'lineDisconnected' | 'windowClosed';

/**
 * Chat: one conversation's messages by day, oldest first, and a reply inside the 24-hour window (W6). Opening it
 * marks it read (W8). A reply carries one idempotency key, the same on a retry after a lost answer, so the customer
 * never gets it twice. An inactive plan keeps reading and media and closes replying (O6).
 */
@Component({
  selector: 'app-chat',
  imports: [
    Avatar,
    BusyButton,
    CdkTextareaAutosize,
    ErrorMessagePipe,
    FormField,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MessageBubble,
    MessageMedia,
    RouterLink,
    Skeleton,
    StateView,
    TranslatePipe,
    ZonedDatePipe,
  ],
  templateUrl: './chat.html',
  styleUrl: './chat.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Chat {
  protected readonly store = inject(ConversationStore);
  private readonly inbox = inject(InboxStore);
  protected readonly organization = inject(CurrentOrganization);
  protected readonly establishment = inject(CurrentEstablishment);
  private readonly team = inject(EstablishmentTeam);

  /** From the route `bandeja/:conversationId`. */
  readonly conversationId = input.required<string>();

  protected readonly maxLength = REPLY_MAX_LENGTH;
  protected readonly now = signal(new Date());
  protected readonly names = computed(() => memberNames(this.team.membersById()));

  protected readonly conversation = computed(() => {
    const c = this.store.conversation.hasValue() ? this.store.conversation.value() : null;
    return c?.id === this.conversationId() ? c : null;
  });
  protected readonly name = computed(() => {
    const c = this.conversation();
    return c && !c.customerDeleted ? (c.customerName ?? c.customerPhone) : null;
  });
  protected readonly named = computed(() => {
    const c = this.conversation();
    return !!c && !c.customerDeleted && !!c.customerName && c.customerName !== c.customerPhone;
  });
  protected readonly status = computed(() => {
    const c = this.conversation();
    return c ? conversationStatus(c, this.now()) : null;
  });
  protected readonly pausedBy = computed(() => {
    const id = this.status()?.memberId;
    return id ? (this.names().get(id) ?? null) : null;
  });
  protected readonly assignee = computed(() => {
    const id = this.conversation()?.assignedMemberId;
    return id ? (this.names().get(id) ?? null) : null;
  });

  protected readonly days = computed<readonly Day[]>(() => {
    const tz = this.establishment.timeZone();
    const messages = this.store.messages();
    if (!tz || !messages || this.store.openedId() !== this.conversationId()) return [];
    const days: { day: LocalDate; messages: Message[] }[] = [];
    for (const message of messages) {
      const day = LocalDate.of(message.occurredAt, tz);
      const last = days.at(-1);
      if (last?.day.equals(day)) last.messages.push(message);
      else days.push({ day, messages: [message] });
    }
    return days;
  });
  protected readonly today = computed(() => {
    const tz = this.establishment.timeZone();
    return tz ? LocalDate.of(this.now(), tz) : null;
  });

  protected readonly loadError = computed(() => {
    const error = this.store.conversation.error() ?? this.store.latest.error();
    return error ? ApiError.of(error) : null;
  });
  protected readonly errorKind = computed<StateKind>(() => {
    const code = this.loadError()?.code;
    if (code === 'NETWORK_ERROR') return 'offline';
    if (code === 'ACCESS_DENIED') return 'forbidden';
    if (code === 'CONVERSATION_NOT_FOUND') return 'notFound';
    return 'error';
  });

  protected readonly block = computed<ReplyBlock | null>(() => {
    const c = this.conversation();
    if (!c) return null;
    if (c.customerDeleted) return 'customerDeleted';
    if (!this.organization.planActive()) return 'planInactive';
    const line = this.inbox.line.hasValue() ? this.inbox.line.value() : null;
    if (line && !line.connected) return 'lineDisconnected';
    if (!c.windowOpen(this.now())) return 'windowClosed';
    return null;
  });

  protected readonly model = signal({ body: '' });
  protected readonly reply = form(this.model, (path) => {
    maxLength(path.body, REPLY_MAX_LENGTH);
  });
  protected readonly busy = signal(false);
  protected readonly error = signal<ApiError | null>(null);
  private key = newIdempotencyKey();
  /** The text the key was last sent with; another text is another message. */
  private keyInput: string | null = null;

  private readonly scroller = viewChild<ElementRef<HTMLElement>>('scroller');
  private readonly log = viewChild<ElementRef<HTMLElement>>('log');
  /** Follow new messages while the newest is in view; scrolling up to read older ones stops it. */
  private stick = true;
  private lastScrollTop = 0;

  constructor() {
    effect(() => {
      const id = this.conversationId();
      untracked(() => {
        this.store.open(id);
        this.model.set({ body: '' });
        this.error.set(null);
        this.key = newIdempotencyKey();
        this.keyInput = null;
        this.stick = true;
        this.lastScrollTop = 0;
      });
    });
    const destroyRef = inject(DestroyRef);
    const toBottom = () => {
      const element = this.scroller()?.nativeElement;
      if (element && this.stick) element.scrollTop = element.scrollHeight;
    };
    // Photos load after the messages render; keep following while the log grows.
    const growth = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(toBottom);
    let observed: HTMLElement | null = null;
    afterRenderEffect(() => {
      this.days();
      const log = this.log()?.nativeElement ?? null;
      if (growth && log !== observed) {
        if (observed) growth.unobserve(observed);
        if (log) growth.observe(log);
        observed = log;
      }
      toBottom();
    });
    destroyRef.onDestroy(() => growth?.disconnect());
    const timer = setInterval(() => this.now.set(new Date()), 30_000);
    destroyRef.onDestroy(() => {
      clearInterval(timer);
      this.store.open(null);
    });
  }

  /** Only the user scrolls up; following the log scrolls down, even when a photo grows it meanwhile. */
  protected scrolled(element: HTMLElement): void {
    if (element.scrollHeight - element.scrollTop - element.clientHeight < 48) this.stick = true;
    else if (element.scrollTop < this.lastScrollTop) this.stick = false;
    this.lastScrollTop = element.scrollTop;
  }

  protected isToday(day: LocalDate): boolean {
    return day.equals(this.today());
  }

  protected isYesterday(day: LocalDate): boolean {
    return !!this.today() && day.equals(this.today()!.plusDays(-1));
  }

  protected retry(): void {
    this.store.conversation.reload();
    this.store.latest.reload();
  }

  protected async send(): Promise<void> {
    const body = this.model().body.trim();
    if (!body || this.busy() || this.reply().invalid() || this.block()) return;
    if (this.keyInput !== null && this.keyInput !== body) this.key = newIdempotencyKey();
    this.keyInput = body;
    this.busy.set(true);
    this.error.set(null);
    try {
      await this.store.send(body, this.key);
      this.model.set({ body: '' });
      this.renewKey();
      this.stick = true;
    } catch (error) {
      const failure = ApiError.of(error);
      this.error.set(failure);
      if (!failure.retryable) this.renewKey();
      if (failure.code === 'WINDOW_CLOSED') this.store.conversation.reload();
      if (failure.code === 'LINE_DISCONNECTED') this.inbox.line.reload();
    } finally {
      this.busy.set(false);
    }
  }

  private renewKey(): void {
    this.key = newIdempotencyKey();
    this.keyInput = null;
  }
}
