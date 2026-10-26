import { CdkTextareaAutosize } from '@angular/cdk/text-field';
import { NgTemplateOutlet } from '@angular/common';
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
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { UpcomingAppointments } from '../../../../booking/public-api';
import {
  CurrentEstablishment,
  CurrentOrganization,
  EstablishmentTeam,
} from '../../../../organization/public-api';
import { ApiError } from '../../../../shared/domain/model/api-error';
import { newIdempotencyKey } from '../../../../shared/domain/model/idempotency-key';
import { LocalDate } from '../../../../shared/domain/model/local-date';
import { Avatar } from '../../../../shared/presentation/components/avatar/avatar';
import { BrandMark } from '../../../../shared/presentation/components/brand-mark/brand-mark';
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
import { SendTemplate, templateChoices } from '../../../domain/model/template-choice';
import { MessageBubble } from '../../components/message-bubble/message-bubble';
import { TemplatePicker } from '../../components/template-picker/template-picker';
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

/** A header action that failed, kept so a retry after a lost answer sends the same key. */
interface ActionFailure {
  readonly action: 'pause' | 'resume' | 'assign';
  readonly key: string | null;
  readonly memberId: string | null;
  readonly error: ApiError;
}

/**
 * Chat: one conversation's messages by day, oldest first, a reply inside the 24-hour window (W6), and an upcoming
 * appointment's reminder or confirmation at any time (W11, W12). Opening it marks it read (W8). A reply or template
 * carries one idempotency key, the same on a retry after a lost answer, so the customer never gets it twice. The
 * header assigns the chat (W9) and pauses or resumes the assistant (A3, A7). An inactive plan keeps reading, media,
 * assigning and the assistant controls, and closes sending (O6).
 */
@Component({
  selector: 'app-chat',
  imports: [
    Avatar,
    BrandMark,
    BusyButton,
    CdkTextareaAutosize,
    ErrorMessagePipe,
    FormField,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatMenuModule,
    MatProgressBarModule,
    MessageBubble,
    MessageMedia,
    NgTemplateOutlet,
    RouterLink,
    Skeleton,
    StateView,
    TemplatePicker,
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
  protected readonly upcoming = inject(UpcomingAppointments);

  /** From the route `mensajes/:conversationId`. */
  readonly conversationId = input.required<string>();

  protected readonly maxLength = REPLY_MAX_LENGTH;
  protected readonly now = signal(new Date());
  protected readonly names = computed(() => memberNames(this.team.membersById()));
  protected readonly serviceNames = computed(
    () => new Map([...this.team.servicesById()].map(([id, service]) => [id, service.name])),
  );

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
  /** W9: the active members who work at the conversation's establishment (O13). */
  protected readonly assignees = computed(() => {
    const establishmentId = this.conversation()?.establishmentId;
    if (!establishmentId) return [];
    return this.team.members
      .value()
      .filter((member) => member.status === 'active' && member.worksAt(establishmentId));
  });
  /** A3, A7: pause while the assistant may answer; otherwise resume. */
  protected readonly assistantActive = computed(() => {
    const c = this.conversation();
    return !!c && c.assistantState(this.now()).kind === 'active';
  });
  protected readonly line = computed(() =>
    this.inbox.line.hasValue() ? this.inbox.line.value() : null,
  );

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
    const line = this.line();
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

  /** Inside the window, the templates open on request; outside it they are all that can be sent. */
  protected readonly showTemplates = signal(false);
  protected readonly templatesShown = computed(() => {
    const block = this.block();
    return block === 'windowClosed' || (block === null && this.showTemplates());
  });
  protected readonly choices = computed(() => {
    const c = this.conversation();
    return c ? templateChoices(c, this.line(), this.now()) : [];
  });
  protected readonly upcomingAppointments = computed(() =>
    this.upcoming.appointments.hasValue() ? this.upcoming.appointments.value() : null,
  );
  protected readonly upcomingError = computed(() => {
    const error = this.upcoming.appointments.error();
    return error ? ApiError.of(error) : null;
  });
  protected readonly templateBusy = signal(false);
  protected readonly templateError = signal<ApiError | null>(null);
  private templateKey = newIdempotencyKey();
  /** The template and appointment the key was last sent with, as JSON. */
  private templateKeyInput: string | null = null;

  protected readonly acting = signal<ActionFailure['action'] | null>(null);
  protected readonly failure = signal<ActionFailure | null>(null);

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
        this.showTemplates.set(false);
        this.templateError.set(null);
        this.renewTemplateKey();
        this.failure.set(null);
        this.stick = true;
        this.lastScrollTop = 0;
      });
    });
    // Read the customer's appointments only while the templates are shown.
    effect(() => {
      const c = this.conversation();
      const customerId = c && this.templatesShown() ? c.customerId : null;
      untracked(() => this.upcoming.select(customerId));
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
      this.upcoming.select(null);
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

  /** W11, W12. Another template or appointment is another message, so it gets a new key. */
  protected async sendTemplate(command: SendTemplate): Promise<void> {
    if (this.templateBusy()) return;
    const input = JSON.stringify(command);
    if (this.templateKeyInput !== null && this.templateKeyInput !== input) this.renewTemplateKey();
    this.templateKeyInput = input;
    this.templateBusy.set(true);
    this.templateError.set(null);
    try {
      await this.store.sendTemplate(command, this.templateKey);
      this.renewTemplateKey();
      this.showTemplates.set(false);
      this.stick = true;
    } catch (error) {
      const failure = ApiError.of(error);
      this.templateError.set(failure);
      if (!failure.retryable) this.renewTemplateKey();
      if (failure.code === 'TEMPLATE_NOT_APPROVED' || failure.code === 'LINE_DISCONNECTED')
        this.inbox.line.reload();
      if (failure.code === 'APPOINTMENT_NOT_UPCOMING') this.upcoming.reload();
      if (failure.code === 'CUSTOMER_DELETED') this.store.conversation.reload();
    } finally {
      this.templateBusy.set(false);
    }
  }

  /** A3, A7: a retry after a lost answer sends the same key, so the change happens once. */
  protected async assistant(action: 'pause' | 'resume'): Promise<void> {
    if (this.acting()) return;
    const prior = this.failure();
    const key =
      prior?.action === action && prior.error.retryable && prior.key
        ? prior.key
        : newIdempotencyKey();
    this.acting.set(action);
    this.failure.set(null);
    try {
      if (action === 'pause') await this.store.pauseAssistant(key);
      else await this.store.resumeAssistant(key);
    } catch (error) {
      this.failure.set({ action, key, memberId: null, error: ApiError.of(error) });
    } finally {
      this.acting.set(null);
    }
  }

  /** W9: informative; `null` unassigns. The PUT takes no key, since repeating it changes nothing. */
  protected async assign(memberId: string | null): Promise<void> {
    if (this.acting() || memberId === (this.conversation()?.assignedMemberId ?? null)) return;
    this.acting.set('assign');
    this.failure.set(null);
    try {
      await this.store.assign(memberId);
    } catch (error) {
      this.failure.set({ action: 'assign', key: null, memberId, error: ApiError.of(error) });
    } finally {
      this.acting.set(null);
    }
  }

  protected retryAction(failure: ActionFailure): void {
    if (failure.action === 'assign') void this.assign(failure.memberId);
    else void this.assistant(failure.action);
  }

  private renewTemplateKey(): void {
    this.templateKey = newIdempotencyKey();
    this.templateKeyInput = null;
  }

  private renewKey(): void {
    this.key = newIdempotencyKey();
    this.keyInput = null;
  }
}
