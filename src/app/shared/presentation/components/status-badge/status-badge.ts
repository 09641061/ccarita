import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe } from '@ngx-translate/core';

/** pibble's appointment statuses; booking's `AppointmentStatus` is the same union. */
export type AppointmentStatusKind =
  'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';

const ICONS: Record<AppointmentStatusKind, string> = {
  confirmed: 'check',
  in_progress: 'play_arrow',
  completed: 'check_circle',
  cancelled: 'close',
  no_show: 'person_off',
};

/** An appointment's status as icon and text, never color alone (Sistema visual). */
@Component({
  selector: 'app-status-badge',
  imports: [MatIconModule, TranslatePipe],
  template: `<mat-icon aria-hidden="true">{{ icon() }}</mat-icon
    >{{ 'shared.appointmentStatus.' + status() | translate }}`,
  styleUrl: './status-badge.scss',
  host: { '[class]': 'status()' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatusBadge {
  readonly status = input.required<AppointmentStatusKind>();

  protected readonly icon = computed(() => ICONS[this.status()]);
}
