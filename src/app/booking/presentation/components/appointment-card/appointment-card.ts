import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe } from '@ngx-translate/core';
import { BrandMark } from '../../../../shared/presentation/components/brand-mark/brand-mark';
import { StatusBadge } from '../../../../shared/presentation/components/status-badge/status-badge';
import { ZonedDatePipe } from '../../../../shared/presentation/pipes/zoned-date.pipe';
import { AppointmentEntry } from '../../calendar-entries';

/**
 * One appointment in the calendar: customer, the assistant's mark when it booked it, status as icon and text,
 * service, member, price, and the block it collides with (B15). `compact` is the desktop grid's version.
 */
@Component({
  selector: 'app-appointment-card',
  imports: [BrandMark, MatIconModule, StatusBadge, TranslatePipe, ZonedDatePipe],
  templateUrl: './appointment-card.html',
  styleUrl: './appointment-card.scss',
  host: {
    '[class]': 'entry().appointment.status',
    '[class.compact]': 'compact()',
    '[class.conflict]': 'entry().conflict !== null',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppointmentCard {
  readonly entry = input.required<AppointmentEntry>();
  readonly timeZone = input.required<string>();
  readonly compact = input(false);
}
