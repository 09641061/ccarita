import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { ZonedDatePipe } from '../../../../shared/presentation/pipes/zoned-date.pipe';
import { PlanKind } from '../../../domain/model/organization';

/** The plan and its end date in the drawer (O5), in the establishment's time zone. */
@Component({
  selector: 'app-plan-card',
  imports: [RouterLink, TranslatePipe, ZonedDatePipe],
  template: `
    <span class="tk-label">{{ planKey() | translate }}</span>
    <span class="until">{{
      (active() ? 'organization.plan.activeUntil' : 'organization.plan.endedOn')
        | translate: { date: until() | zonedDate: timeZone() }
    }}</span>
    @if (showLink()) {
      <a routerLink="/organizacion">{{ 'organization.plan.see' | translate }}</a>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 12px;
      border-radius: 12px;
      background: var(--mat-sys-surface-container);
    }
    :host(.ended) {
      background: var(--tk-warning-bg);
    }
    .tk-label {
      font-size: 12px;
    }
    .until {
      font-size: 13px;
      font-weight: 500;
    }
    a {
      font-size: 13px;
      color: var(--mat-sys-on-primary-container);
      text-underline-offset: 3px;
    }
  `,
  host: { '[class.ended]': '!active()' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlanCard {
  /** `null` while pibble's details are loading. */
  readonly plan = input<PlanKind | null>(null);
  readonly until = input.required<Date>();
  readonly timeZone = input.required<string>();
  readonly active = input.required<boolean>();
  /** Only owners see the organization screen, where the plan lives (03 §5). */
  readonly showLink = input(false);

  protected readonly planKey = computed(() => {
    const plan = this.plan();
    return plan ? `organization.plan.${plan}` : 'organization.plan.current';
  });
}
