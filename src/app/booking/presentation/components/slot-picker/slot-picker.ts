import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { TranslatePipe } from '@ngx-translate/core';
import { ZonedDatePipe } from '../../../../shared/presentation/pipes/zoned-date.pipe';
import { DayPart, Slot } from '../../../domain/model/slot';

/** How many times of each part of the day show before "Ver toda la mañana". */
export const SLOTS_SHOWN = 8;

interface SlotGroup {
  readonly part: DayPart;
  readonly slots: readonly Slot[];
  readonly hidden: number;
}

/** The free times of one day, as morning and afternoon, each with how many people are free (B16). */
@Component({
  selector: 'app-slot-picker',
  imports: [MatButtonModule, TranslatePipe, ZonedDatePipe],
  templateUrl: './slot-picker.html',
  styleUrl: './slot-picker.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SlotPicker {
  readonly slots = input.required<readonly Slot[]>();
  readonly timeZone = input.required<string>();
  readonly selected = input<Slot | null>(null);
  /** Whether to show "N libres" under each time; off when one member is chosen. */
  readonly showFree = input(true);
  readonly choose = output<Slot>();

  private readonly expanded = signal<ReadonlySet<DayPart>>(new Set());

  protected readonly groups = computed<SlotGroup[]>(() => {
    const timeZone = this.timeZone();
    const selected = this.selected()?.start.getTime();
    return (['morning', 'afternoon'] as const)
      .map((part) => {
        const all = this.slots().filter((slot) => slot.partOfDay(timeZone) === part);
        const chosenAt = all.findIndex((slot) => slot.start.getTime() === selected);
        const limit = this.expanded().has(part) ? all.length : Math.max(SLOTS_SHOWN, chosenAt + 1);
        return {
          part,
          slots: all.slice(0, limit),
          hidden: all.length - Math.min(limit, all.length),
        };
      })
      .filter((group) => group.slots.length > 0);
  });

  protected isSelected(slot: Slot): boolean {
    return this.selected()?.start.getTime() === slot.start.getTime();
  }

  protected expand(part: DayPart): void {
    this.expanded.update((parts) => new Set([...parts, part]));
  }
}
