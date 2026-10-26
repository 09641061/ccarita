import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { TranslatePipe } from '@ngx-translate/core';
import { CurrentEstablishment, CurrentOrganization } from '../../../../organization/public-api';
import { ApiError } from '../../../../shared/domain/model/api-error';
import { LocalDate } from '../../../../shared/domain/model/local-date';
import { Skeleton } from '../../../../shared/presentation/components/skeleton/skeleton';
import {
  StateKind,
  StateView,
} from '../../../../shared/presentation/components/state-view/state-view';
import { ZonedDatePipe } from '../../../../shared/presentation/pipes/zoned-date.pipe';
import { AssistantUsageStore } from '../../../application/assistant-usage.store';
import { UsagePeriod, UsagePeriodProblem } from '../../../domain/model/usage-period';

/**
 * Ajustes › Uso, for owners and managers (03 §5): the assistant's answered turns, tokens and tool calls per day of
 * the establishment, for a period of up to 366 days (A9), also while the plan is inactive. Only days with answered
 * turns are listed, newest first, as pibble sends them; the total row covers the whole period. Tokens, never money.
 */
@Component({
  selector: 'app-usage-report',
  imports: [
    DecimalPipe,
    MatFormFieldModule,
    MatInputModule,
    MatProgressBarModule,
    Skeleton,
    StateView,
    TranslatePipe,
    ZonedDatePipe,
  ],
  templateUrl: './usage-report.html',
  styleUrl: './usage-report.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UsageReport {
  protected readonly store = inject(AssistantUsageStore);
  protected readonly organization = inject(CurrentOrganization);
  protected readonly establishment = inject(CurrentEstablishment);

  protected readonly maxDays = UsagePeriod.MAX_DAYS;
  protected readonly from = signal('');
  protected readonly to = signal('');

  protected readonly usage = computed(() =>
    this.store.usage.hasValue() ? this.store.usage.value() : null,
  );
  protected readonly loadError = computed(() => {
    const error = this.store.usage.error();
    return error ? ApiError.of(error) : null;
  });
  protected readonly errorKind = computed<StateKind>(() => {
    switch (this.loadError()?.code) {
      case 'ACCESS_DENIED':
        return 'forbidden';
      case 'NETWORK_ERROR':
        return 'offline';
      default:
        return 'error';
    }
  });

  /** Why the typed days cannot be asked for; checked before calling pibble. */
  protected readonly problem = computed<UsagePeriodProblem | 'format' | null>(() => {
    const from = parse(this.from());
    const to = parse(this.to());
    if (!from || !to) return 'format';
    return UsagePeriod.problemOf(from, to);
  });

  constructor() {
    // The inputs show the store's period, the default one included.
    effect(() => {
      const period = this.store.period();
      if (!period) return;
      this.from.set(period.from.toString());
      this.to.set(period.to.toString());
    });
  }

  protected change(field: 'from' | 'to', value: string): void {
    this[field].set(value);
    const from = parse(this.from());
    const to = parse(this.to());
    if (from && to && !UsagePeriod.problemOf(from, to)) this.store.choose(UsagePeriod.of(from, to));
  }
}

function parse(text: string): LocalDate | null {
  try {
    return LocalDate.parse(text);
  } catch {
    return null;
  }
}
