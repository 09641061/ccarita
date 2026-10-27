import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe } from '@ngx-translate/core';
import { ZonedDatePipe } from '../../pipes/zoned-date.pipe';

/**
 * The fixed notice of an inactive plan (O6, PLAN_INACTIVE). Inputs only: the session shows it on
 * every screen while `planActive()` is false and passes the end date, the establishment's time
 * zone and `RENEWAL_CONTACT`.
 */
@Component({
  selector: 'app-plan-banner',
  imports: [MatIconModule, TranslatePipe, ZonedDatePipe],
  template: `
    <mat-icon aria-hidden="true">event_busy</mat-icon>
    <div>
      <h2>
        {{ 'shared.plan.ended' | translate: { date: endedOn() | zonedDate: timeZone() } }}
      </h2>
      <p>{{ 'shared.plan.consequences' | translate }}</p>
      <p>{{ 'shared.plan.renew' | translate: { contact: renewalContact() } }}</p>
    </div>
  `,
  styles: `
    :host {
      display: flex;
      gap: 12px;
      padding: 14px 16px;
      border-radius: 12px;
      color: var(--mat-sys-on-surface);
      background: var(--tk-warning-bg);
    }
    mat-icon {
      flex: none;
      color: var(--tk-warning);
    }
    h2 {
      font-size: 15px;
      margin-bottom: 2px;
    }
    p {
      font-size: 14px;
      color: var(--mat-sys-on-surface-variant);
    }
  `,
  host: { role: 'status' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlanBanner {
  readonly endedOn = input.required<Date>();
  /** The establishment's IANA time zone, such as `America/Lima`. */
  readonly timeZone = input.required<string>();
  readonly renewalContact = input.required<string>();
}
