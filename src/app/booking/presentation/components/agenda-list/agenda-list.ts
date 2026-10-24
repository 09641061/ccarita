import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { LocalDate } from '../../../../shared/domain/model/local-date';
import { ZonedDatePipe } from '../../../../shared/presentation/pipes/zoned-date.pipe';
import { BlockEntry, CalendarEntry } from '../../calendar-entries';
import { AppointmentCard } from '../appointment-card/appointment-card';
import { BlockCard } from '../block-card/block-card';

export interface AgendaDay {
  readonly day: LocalDate;
  readonly entries: readonly CalendarEntry[];
}

/**
 * The phone calendar (Calendario · móvil): each day's appointments and blocks in time order, with the current
 * time marked on today. A week shows a heading per day.
 */
@Component({
  selector: 'app-agenda-list',
  imports: [AppointmentCard, BlockCard, NgTemplateOutlet, RouterLink, TranslatePipe, ZonedDatePipe],
  templateUrl: './agenda-list.html',
  styleUrl: './agenda-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AgendaList {
  readonly days = input.required<readonly AgendaDay[]>();
  readonly timeZone = input.required<string>();
  readonly now = input.required<Date>();
  readonly headings = input(false);
  readonly removeBlock = output<BlockEntry>();

  /** Per day, the index of the first entry after now on today, else -1. */
  protected readonly nowIndex = computed(() => {
    const now = this.now();
    const today = LocalDate.of(now, this.timeZone());
    return this.days().map(({ day, entries }) => {
      if (!day.equals(today)) return -1;
      const after = entries.findIndex((entry) => entry.start > now);
      return after === -1 ? entries.length : after;
    });
  });
}
