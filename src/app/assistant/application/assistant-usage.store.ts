import { Injectable, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { CurrentEstablishment } from '../../organization/public-api';
import { UsagePeriod } from '../domain/model/usage-period';
import { AssistantUsageApi } from '../infrastructure/assistant-usage.api';

/** The days the usage screen opens with. */
export const DEFAULT_USAGE_DAYS = 7;

/** A9: the selected establishment's assistant usage over a period of its days, also while the plan is inactive. */
@Injectable({ providedIn: 'root' })
export class AssistantUsageStore {
  private readonly api = inject(AssistantUsageApi);
  private readonly establishment = inject(CurrentEstablishment);
  private readonly chosen = signal<UsagePeriod | null>(null);

  /** The chosen period, else the last 7 days in the establishment's time zone; `null` until one is loaded. */
  readonly period = computed(() => {
    const chosen = this.chosen();
    if (chosen) return chosen;
    const timeZone = this.establishment.timeZone();
    return timeZone ? UsagePeriod.lastDays(DEFAULT_USAGE_DAYS, new Date(), timeZone) : null;
  });

  /** Reloads with the establishment or the period. */
  readonly usage = rxResource({
    params: () => {
      const establishmentId = this.establishment.id();
      const period = this.period();
      return establishmentId && period ? { establishmentId, period } : undefined;
    },
    stream: ({ params }) => this.api.forPeriod(params.establishmentId, params.period),
  });

  choose(period: UsagePeriod): void {
    if (!period.equals(this.period())) this.chosen.set(period);
  }
}
