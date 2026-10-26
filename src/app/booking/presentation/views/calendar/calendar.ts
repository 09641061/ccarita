import { BreakpointObserver } from '@angular/cdk/layout';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterLink, RouterOutlet } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { map } from 'rxjs';
import { CustomerDirectory } from '../../../../customers/public-api';
import {
  CurrentEstablishment,
  CurrentOrganization,
  EstablishmentTeam,
} from '../../../../organization/public-api';
import { ApiError } from '../../../../shared/domain/model/api-error';
import { LocalDate } from '../../../../shared/domain/model/local-date';
import { BrandMark } from '../../../../shared/presentation/components/brand-mark/brand-mark';
import { Skeleton } from '../../../../shared/presentation/components/skeleton/skeleton';
import {
  StateKind,
  StateView,
} from '../../../../shared/presentation/components/state-view/state-view';
import { ZonedDatePipe } from '../../../../shared/presentation/pipes/zoned-date.pipe';
import { CalendarStore } from '../../../application/calendar.store';
import { CalendarView } from '../../../domain/model/calendar-range';
import { BlockEntry, EntrySources, entriesOfDay } from '../../calendar-entries';
import { AgendaDay, AgendaList } from '../../components/agenda-list/agenda-list';
import { CalendarGrid, GridColumn } from '../../components/calendar-grid/calendar-grid';
import { BlockRemovalDialog } from '../block-removal-dialog/block-removal-dialog';
import { TimeBlockDialog, TimeBlockDialogData } from '../time-block-dialog/time-block-dialog';
import { DIALOG_OPTIONS } from '../../../../shared/presentation/dialog-options';

/**
 * The calendar of the selected establishment (Calendario · móvil, Calendario · escritorio): a list per day on
 * phones, hours by member or by day on desktops. The appointment detail opens beside it on desktops and in its
 * place on phones. Booking is disabled while the plan is inactive (O6); blocks still change.
 */
@Component({
  selector: 'app-calendar',
  imports: [
    AgendaList,
    BrandMark,
    CalendarGrid,
    MatButtonModule,
    MatButtonToggleModule,
    MatIconModule,
    MatProgressBarModule,
    RouterLink,
    RouterOutlet,
    Skeleton,
    StateView,
    TranslatePipe,
    ZonedDatePipe,
  ],
  templateUrl: './calendar.html',
  styleUrl: './calendar.scss',
  host: { '[class.detail-open]': 'detailOpen()', '[class.desktop]': 'desktop()' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Calendar {
  protected readonly store = inject(CalendarStore);
  protected readonly organization = inject(CurrentOrganization);
  protected readonly establishment = inject(CurrentEstablishment);
  private readonly team = inject(EstablishmentTeam);
  private readonly directory = inject(CustomerDirectory);
  private readonly dialog = inject(MatDialog);
  private readonly translate = inject(TranslateService);

  protected readonly desktop = toSignal(
    inject(BreakpointObserver)
      .observe('(min-width: 1024px)')
      .pipe(map((state) => state.matches)),
    { initialValue: false },
  );
  protected readonly detailOpen = signal(false);
  /** The current time, for the now line; refreshed every minute. */
  protected readonly now = signal(new Date());

  protected readonly today = computed(() => {
    const tz = this.store.timeZone();
    return tz ? LocalDate.of(this.now(), tz) : null;
  });
  /** The week of the chosen day, for the phone's day strip. */
  protected readonly strip = computed(() => {
    const start = this.store.day()?.startOfWeek();
    return start ? Array.from({ length: 7 }, (_, i) => start.plusDays(i)) : [];
  });

  private readonly sources = computed<EntrySources>(() => ({
    members: this.team.membersById(),
    memberOrder: this.store.members().map((m) => m.id),
    services: this.team.servicesById(),
    customers: this.directory.customers(),
    conflicts: this.store.conflicts(),
    canManage: (block) => this.store.canManage(block),
  }));

  protected readonly agenda = computed<AgendaDay[]>(() => {
    const range = this.store.range();
    const tz = this.store.timeZone();
    if (!range || !tz) return [];
    return range.days.map((day) => ({
      day,
      entries: entriesOfDay(
        day,
        tz,
        this.store.visibleAppointments(),
        this.store.visibleTimeBlocks(),
        this.sources(),
      ),
    }));
  });

  protected readonly isEmpty = computed(() => this.agenda().every((d) => d.entries.length === 0));

  /** A column per member on a day (only the chosen one when filtered), or a column per day of the week. */
  protected readonly columns = computed<GridColumn[]>(() => {
    const range = this.store.range();
    const tz = this.store.timeZone();
    if (!range || !tz) return [];
    const sources = this.sources();
    if (range.view === 'week') {
      return this.agenda().map(({ day, entries }) => ({
        key: day.toString(),
        label: null,
        count: null,
        avatar: null,
        day,
        entries,
      }));
    }
    const day = range.days[0];
    const appointments = this.store.visibleAppointments();
    const memberIds = this.store.memberId()
      ? [this.store.memberId()!]
      : [
          ...this.store.members().map((m) => m.id),
          ...appointments
            .map((a) => a.staffMemberId)
            .filter((id) => !this.store.members().some((m) => m.id === id)),
        ];
    return [...new Set(memberIds)].map((memberId, index) => {
      const member = sources.members.get(memberId);
      const own = appointments.filter((a) => a.staffMemberId === memberId);
      const blocks = this.store.visibleTimeBlocks().filter((b) => b.appliesTo(memberId));
      const entries = entriesOfDay(day, tz, own, blocks, sources);
      const count = entries.filter(
        (e) => e.kind === 'appointment' && e.appointment.occupiesTime,
      ).length;
      return {
        key: memberId,
        label: member?.name ?? null,
        count,
        avatar: member ? { name: member.name, index } : null,
        day,
        entries,
      };
    });
  });

  protected readonly loadError = computed(() => {
    const error = this.store.appointments.error() ?? this.store.timeBlocks.error();
    return error ? ApiError.of(error) : null;
  });
  protected readonly errorKind = computed<StateKind>(() => {
    const error = this.loadError();
    if (error?.code === 'NETWORK_ERROR') return 'offline';
    if (error?.code === 'ACCESS_DENIED') return 'forbidden';
    return 'error';
  });

  constructor() {
    const timer = setInterval(() => this.now.set(new Date()), 60_000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  protected isToday(day: LocalDate): boolean {
    return day.equals(this.today());
  }

  protected showView(view: CalendarView): void {
    this.store.showView(view);
  }

  protected retry(): void {
    this.store.appointments.reload();
    this.store.timeBlocks.reload();
  }

  protected blockTime(): void {
    const day = this.store.day();
    const timeZone = this.store.timeZone();
    if (!day || !timeZone) return;
    const data: TimeBlockDialogData = {
      day,
      timeZone,
      members: this.store.managesEveryone()
        ? this.store.members()
        : this.store.members().filter((m) => m.id === this.organization.memberId()),
      memberId: this.store.managesEveryone() ? this.store.memberId() : this.organization.memberId(),
      managesEveryone: this.store.managesEveryone(),
    };
    this.dialog.open(TimeBlockDialog, {
      ...DIALOG_OPTIONS,
      data,
      ariaLabel: this.translate.instant('booking.timeBlock.title'),
    });
  }

  protected removeBlock(entry: BlockEntry): void {
    const timeZone = this.store.timeZone();
    if (!timeZone) return;
    this.dialog.open(BlockRemovalDialog, {
      ...DIALOG_OPTIONS,
      data: { entry, timeZone },
      ariaLabel: this.translate.instant('booking.block.removeTitle'),
    });
  }
}
