import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ApiError } from '../../../../shared/domain/model/api-error';
import { LocalDate } from '../../../../shared/domain/model/local-date';
import { UsagePeriod } from '../../../../shared/domain/model/usage-period';
import { Skeleton } from '../../../../shared/presentation/components/skeleton/skeleton';
import {
  StateKind,
  StateView,
} from '../../../../shared/presentation/components/state-view/state-view';
import { ZonedDatePipe } from '../../../../shared/presentation/pipes/zoned-date.pipe';
import { OrganizationAccountStore } from '../../../application/organization-account.store';
import { OrganizationAccountsStore } from '../../../application/organization-accounts.store';
import { OPERATOR_TIME_ZONE } from '../../../domain/model/organization-account';
import { PlanChange } from '../../../domain/model/plan-change';
import { ChangePlanSheet } from '../change-plan-sheet/change-plan-sheet';

function kindOf(error: unknown): StateKind {
  switch (ApiError.of(error).code) {
    case 'ACCESS_DENIED':
      return 'forbidden';
    case 'NETWORK_ERROR':
      return 'offline';
    default:
      return 'error';
  }
}

function parse(text: string): LocalDate | null {
  try {
    return LocalDate.parse(text);
  } catch {
    return null;
  }
}

/**
 * One organization for the Takodu team (`/platform/:organizationId`): its plan and establishments against the
 * limit (O4, O5), recording a payment or plan change, the plan history newest first, and its assistant usage per
 * establishment over up to 366 days (A9). Plan dates show in Lima; usage days are each establishment's own.
 */
@Component({
  selector: 'app-organization-account',
  imports: [
    DecimalPipe,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    RouterLink,
    Skeleton,
    StateView,
    TranslatePipe,
    ZonedDatePipe,
  ],
  templateUrl: './organization-account.html',
  styleUrls: ['../platform.scss', './organization-account.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrganizationAccountPage {
  private readonly sheet = inject(MatBottomSheet);
  private readonly translate = inject(TranslateService);
  protected readonly store = inject(OrganizationAccountStore);
  protected readonly accounts = inject(OrganizationAccountsStore);

  /** From the route. */
  readonly organizationId = input.required<string>();

  protected readonly timeZone = OPERATOR_TIME_ZONE;
  protected readonly maxDays = UsagePeriod.MAX_DAYS;
  protected readonly from = signal('');
  protected readonly to = signal('');
  /** The change just recorded, to confirm it. */
  protected readonly recorded = signal<PlanChange | null>(null);

  protected readonly listErrorKind = computed(() => {
    const error = this.accounts.accounts.error();
    return error ? kindOf(error) : null;
  });
  protected readonly historyErrorKind = computed(() => {
    const error = this.store.history.error();
    return error ? kindOf(error) : null;
  });
  protected readonly usageError = computed(() => {
    const error = this.store.usage.error();
    return error ? ApiError.of(error) : null;
  });
  protected readonly usageErrorKind = computed(() => kindOf(this.usageError()));
  protected readonly usage = computed(() =>
    this.store.usage.hasValue() ? this.store.usage.value() : null,
  );

  /** Why the typed days cannot be asked for; checked before calling pibble. */
  protected readonly periodProblem = computed(() => {
    const from = parse(this.from());
    const to = parse(this.to());
    if (!from || !to) return 'format';
    return UsagePeriod.problemOf(from, to);
  });

  constructor() {
    effect(() => {
      const id = this.organizationId();
      untracked(() => {
        this.store.open(id);
        this.recorded.set(null);
      });
    });
    effect(() => {
      const period = this.store.period();
      this.from.set(period.from.toString());
      this.to.set(period.to.toString());
    });
  }

  protected changePlan(): void {
    const account = this.store.account();
    if (!account) return;
    this.sheet
      .open(ChangePlanSheet, {
        data: account,
        ariaLabel: this.translate.instant('platform.changeSheet.title'),
      })
      .afterDismissed()
      .subscribe((entry) => {
        if (entry) this.recorded.set(entry);
      });
  }

  protected changePeriod(field: 'from' | 'to', value: string): void {
    this[field].set(value);
    const from = parse(this.from());
    const to = parse(this.to());
    if (from && to && !UsagePeriod.problemOf(from, to)) this.store.choose(UsagePeriod.of(from, to));
  }
}
