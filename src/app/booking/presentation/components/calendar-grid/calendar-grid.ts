import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { LocalDate } from '../../../../shared/domain/model/local-date';
import { Avatar } from '../../../../shared/presentation/components/avatar/avatar';
import { ZonedDatePipe } from '../../../../shared/presentation/pipes/zoned-date.pipe';
import { BlockEntry, CalendarEntry } from '../../calendar-entries';
import { AppointmentCard } from '../appointment-card/appointment-card';
import { BlockCard } from '../block-card/block-card';
import { placeInLanes, visibleHours } from './grid-layout';

/** One column of the grid: a member on one day, or one day of the week. */
export interface GridColumn {
  readonly key: string;
  /** Already translated or a name; `day` columns show the date instead. */
  readonly label: string | null;
  /** The member's booked appointments that day; `null` on day columns, which show the date. */
  readonly count: number | null;
  readonly avatar: { readonly name: string; readonly index: number } | null;
  readonly day: LocalDate;
  readonly entries: readonly CalendarEntry[];
}

const HOUR_PX = 64;
const MINUTE_MS = 60_000;

/**
 * The desktop calendar (Calendario · escritorio): hours down the side and a column per member or per day.
 * Appointments and blocks that overlap share the column side by side, so a collision stays visible (B15).
 */
@Component({
  selector: 'app-calendar-grid',
  imports: [
    AppointmentCard,
    Avatar,
    BlockCard,
    RouterLink,
    RouterLinkActive,
    TranslatePipe,
    ZonedDatePipe,
  ],
  templateUrl: './calendar-grid.html',
  styleUrl: './calendar-grid.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CalendarGrid {
  readonly columns = input.required<readonly GridColumn[]>();
  readonly timeZone = input.required<string>();
  readonly now = input.required<Date>();
  readonly removeBlock = output<BlockEntry>();

  protected readonly hourHeight = HOUR_PX;

  protected readonly hours = computed(() => {
    const tz = this.timeZone();
    const minutes = this.columns().flatMap((column) => {
      const dayStart = column.day.startIn(tz).getTime();
      return column.entries.flatMap((e) => [
        (e.start.getTime() - dayStart) / MINUTE_MS,
        (e.end.getTime() - dayStart) / MINUTE_MS,
      ]);
    });
    const { first, last } = visibleHours(minutes);
    return { first, last, labels: Array.from({ length: last - first }, (_, i) => first + i) };
  });

  protected readonly height = computed(() => (this.hours().last - this.hours().first) * HOUR_PX);

  protected readonly layout = computed(() => {
    const tz = this.timeZone();
    const { first, last } = this.hours();
    const now = this.now();
    return this.columns().map((column) => {
      const origin = column.day.startIn(tz).getTime() + first * 60 * MINUTE_MS;
      const bottom = (last - first) * 60;
      const offset = (instant: Date) =>
        Math.min(bottom, Math.max(0, (instant.getTime() - origin) / MINUTE_MS));
      const lanes = placeInLanes(column.entries);
      const items = column.entries.map((entry) => {
        const top = offset(entry.start);
        const placement = lanes.get(entry.id) ?? { lane: 0, lanes: 1 };
        return {
          entry,
          top: (top * HOUR_PX) / 60,
          height: Math.max(22, ((offset(entry.end) - top) * HOUR_PX) / 60),
          left: (placement.lane / placement.lanes) * 100,
          width: 100 / placement.lanes,
        };
      });
      const nowMinutes = (now.getTime() - origin) / MINUTE_MS;
      const today = column.day.equals(LocalDate.of(now, tz));
      return {
        column,
        items,
        now: today && nowMinutes >= 0 && nowMinutes <= bottom ? (nowMinutes * HOUR_PX) / 60 : null,
      };
    });
  });

  protected hourLabel(hour: number): string {
    return `${String(hour).padStart(2, '0')}:00`;
  }
}
