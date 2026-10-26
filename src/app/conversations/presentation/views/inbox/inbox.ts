import { BreakpointObserver } from '@angular/cdk/layout';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Router, RouterOutlet } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { map } from 'rxjs';
import {
  CurrentEstablishment,
  CurrentOrganization,
  EstablishmentTeam,
} from '../../../../organization/public-api';
import { ApiError } from '../../../../shared/domain/model/api-error';
import { Skeleton } from '../../../../shared/presentation/components/skeleton/skeleton';
import {
  StateKind,
  StateView,
} from '../../../../shared/presentation/components/state-view/state-view';
import { ConversationStore } from '../../../application/conversation.store';
import { InboxFilter, InboxStore } from '../../../application/inbox.store';
import { ConversationRow } from '../../components/conversation-row/conversation-row';
import { memberNames } from '../../member-names';
import { SettingsLink } from '../../../../shared/presentation/navigation/settings-link';

const FILTERS: readonly InboxFilter[] = ['all', 'unread', 'mine'];

/**
 * Bandeja: the selected establishment's conversations, newest activity first (W7), kept live by the inbox stream
 * while it is open. A conversation opens beside the list on desktops and in its place on phones. Every role sees
 * it, also on an inactive plan (O6); a stream that dropped is a quiet notice, not an error.
 */
@Component({
  selector: 'app-inbox',
  imports: [
    ConversationRow,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    SettingsLink,
    RouterOutlet,
    Skeleton,
    StateView,
    TranslatePipe,
  ],
  templateUrl: './inbox.html',
  styleUrl: './inbox.scss',
  host: {
    '[class.chat-open]': 'chatOpen()',
    '[class.desktop]': 'desktop()',
    '[style.--inbox-top.px]': 'top()',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Inbox {
  protected readonly store = inject(InboxStore);
  protected readonly chat = inject(ConversationStore);
  protected readonly establishment = inject(CurrentEstablishment);
  protected readonly organization = inject(CurrentOrganization);
  private readonly team = inject(EstablishmentTeam);
  private readonly router = inject(Router);

  protected readonly filters = FILTERS;
  protected readonly desktop = toSignal(
    inject(BreakpointObserver)
      .observe('(min-width: 1024px)')
      .pipe(map((state) => state.matches)),
    { initialValue: false },
  );
  protected readonly chatOpen = signal(false);
  /** Where the panes start on the page, below the top bar and the plan banner, so they fill the rest. */
  protected readonly top = signal(0);
  /** For the times and states of the rows; refreshed every minute. */
  protected readonly now = signal(new Date());
  protected readonly names = computed(() => memberNames(this.team.membersById()));

  protected readonly loadError = computed(() => {
    const error = this.store.firstPage.error();
    return error ? ApiError.of(error) : null;
  });
  protected readonly errorKind = computed<StateKind>(() => {
    const code = this.loadError()?.code;
    if (code === 'NETWORK_ERROR') return 'offline';
    if (code === 'ACCESS_DENIED') return 'forbidden';
    return 'error';
  });
  /** W1: the establishment never had a line; pibble answers 404 for it. */
  protected readonly noLine = computed(
    () => ApiError.of(this.store.line.error() ?? null).code === 'WHATSAPP_LINE_NOT_FOUND',
  );
  protected readonly lineDisconnected = computed(() =>
    this.store.line.hasValue() && !this.store.line.value().connected
      ? this.store.line.value()
      : null,
  );
  protected readonly canConnect = computed(() => this.organization.can('connectWhatsapp'));

  constructor() {
    const destroyRef = inject(DestroyRef);
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const measure = () => this.top.set(host.getBoundingClientRect().top + window.scrollY);
    afterNextRender(() => {
      measure();
      if (typeof ResizeObserver === 'undefined' || !host.parentElement) return;
      const observer = new ResizeObserver(measure);
      observer.observe(host.parentElement);
      destroyRef.onDestroy(() => observer.disconnect());
    });
    destroyRef.onDestroy(this.store.follow());
    const timer = setInterval(() => this.now.set(new Date()), 60_000);
    destroyRef.onDestroy(() => clearInterval(timer));
    // A conversation of the previous establishment closes when another one is chosen.
    let shown: string | null | undefined;
    effect(() => {
      const id = this.establishment.id();
      if (shown !== undefined && id !== shown && this.chatOpen())
        void this.router.navigateByUrl('/bandeja');
      shown = id;
    });
  }

  protected choose(filter: InboxFilter): void {
    this.store.filter.set(this.store.filter() === filter && filter !== 'all' ? 'all' : filter);
  }

  protected retry(): void {
    this.store.firstPage.reload();
    this.store.line.reload();
  }
}
