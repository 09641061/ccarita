import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormField, form, max, maxLength, min, required } from '@angular/forms/signals';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatRadioModule } from '@angular/material/radio';
import { TranslatePipe } from '@ngx-translate/core';
import { ApiError } from '../../../../shared/domain/model/api-error';
import { newIdempotencyKey } from '../../../../shared/domain/model/idempotency-key';
import { LocalDate } from '../../../../shared/domain/model/local-date';
import { BusyButton } from '../../../../shared/presentation/components/busy-button/busy-button';
import { ErrorMessagePipe } from '../../../../shared/presentation/pipes/error-message.pipe';
import { ZonedDatePipe } from '../../../../shared/presentation/pipes/zoned-date.pipe';
import { OrganizationAccountStore } from '../../../application/organization-account.store';
import {
  OPERATOR_TIME_ZONE,
  OrganizationAccount,
  PlanName,
  establishmentLimit,
} from '../../../domain/model/organization-account';
import {
  ChangePlan,
  MAX_EXTEND_DAYS,
  MAX_NOTE_LENGTH,
  PlanChange,
  PlanPeriodChange,
  changePlanProblem,
} from '../../../domain/model/plan-change';

/** How the change moves the end of the paid period; `end` stops the plan now, as for a reversed payment. */
export type PeriodMode = 'extend' | 'until' | 'end' | 'keep';

interface ChangePlanModel {
  plan: PlanName;
  mode: PeriodMode;
  days: number;
  /** A day in Lima; the plan stays active through its last minute. */
  until: string;
  note: string;
}

/** The last minute of a typed day in Lima, so "activo hasta" shows that day. */
const LAST_MINUTE = '23:59';

/**
 * Registrar pago o cambio de plan, for the Takodu team (O4, O5): the plan, how the paid period moves (extend by
 * days, end on a day, stop now, or keep it), and a required note on how the business paid. One idempotency key per
 * input, reused on a retry after a lost answer and renewed after success, a refusal or a change of input.
 */
@Component({
  selector: 'app-change-plan-dialog',
  imports: [
    BusyButton,
    ErrorMessagePipe,
    FormField,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatRadioModule,
    TranslatePipe,
    ZonedDatePipe,
  ],
  templateUrl: './change-plan-dialog.html',
  styleUrl: './change-plan-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChangePlanDialog {
  private readonly store = inject(OrganizationAccountStore);
  private readonly ref = inject(MatDialogRef<ChangePlanDialog, PlanChange>);
  protected readonly account = inject<OrganizationAccount>(MAT_DIALOG_DATA);

  protected readonly timeZone = OPERATOR_TIME_ZONE;
  protected readonly maxDays = MAX_EXTEND_DAYS;
  protected readonly plans: readonly PlanName[] = ['standard', 'max'];
  protected readonly modes: readonly PeriodMode[] = ['extend', 'until', 'end', 'keep'];
  /** The sheet opened at this instant; previews count from it. */
  private readonly now = new Date();

  protected readonly model = signal<ChangePlanModel>({
    plan: this.account.plan,
    mode: 'extend',
    days: 30,
    until: LocalDate.of(this.account.planActiveUntil ?? this.now, OPERATOR_TIME_ZONE).toString(),
    note: '',
  });
  protected readonly planForm = form(this.model, (path) => {
    required(path.note);
    maxLength(path.note, MAX_NOTE_LENGTH);
    min(path.days, 1);
    max(path.days, MAX_EXTEND_DAYS);
  });

  protected readonly busy = signal(false);
  protected readonly error = signal<ApiError | null>(null);
  protected readonly submitted = signal(false);
  private key = newIdempotencyKey();
  private keyInput: string | null = null;

  /** The typed end day as an instant, or `null` when it is not a day. */
  private readonly untilInstant = computed(() => {
    try {
      return LocalDate.parse(this.model().until).atTime(LAST_MINUTE, OPERATOR_TIME_ZONE);
    } catch {
      return null;
    }
  });

  protected readonly change = computed<ChangePlan | null>(() => {
    const model = this.model();
    const period = this.periodOf(model);
    if (!period) return null;
    return {
      plan: model.plan === this.account.plan ? null : model.plan,
      period,
      note: model.note,
    };
  });

  protected readonly problem = computed(() => {
    const change = this.change();
    if (!change) return 'date' as const;
    return changePlanProblem(change);
  });

  /** O5: where the end of the paid period lands; `null` when it does not move. */
  protected readonly newEnd = computed<Date | null>(() => {
    const model = this.model();
    switch (model.mode) {
      case 'extend':
        return Number.isInteger(model.days) && model.days >= 1
          ? this.account.endAfterExtending(model.days, this.now)
          : null;
      case 'until':
        return this.untilInstant();
      case 'end':
        return this.now;
      case 'keep':
        return null;
    }
  });
  protected readonly endsPlan = computed(() => {
    const end = this.newEnd();
    return end !== null && end.getTime() <= this.now.getTime();
  });

  /** O4: a downgrade leaves extra establishments open, but no new one opens. */
  protected readonly downgradeOverLimit = computed(() => {
    const limit = establishmentLimit(this.model().plan);
    return (
      this.model().plan !== this.account.plan &&
      limit !== null &&
      this.account.activeEstablishments > limit
    );
  });

  protected set<K extends keyof ChangePlanModel>(field: K, value: ChangePlanModel[K]): void {
    this.model.update((model) => ({ ...model, [field]: value }));
  }

  protected async confirm(event?: Event): Promise<void> {
    event?.preventDefault();
    this.submitted.set(true);
    this.planForm().markAsTouched();
    const change = this.change();
    if (this.busy() || !change || this.problem()) return;
    const input = JSON.stringify(this.model());
    if (this.keyInput !== null && this.keyInput !== input) this.key = newIdempotencyKey();
    this.keyInput = input;
    this.busy.set(true);
    this.error.set(null);
    try {
      const entry = await this.store.changePlan(change, this.key);
      this.ref.close(entry);
    } catch (error) {
      const failure = ApiError.of(error);
      this.error.set(failure);
      if (!failure.retryable) {
        this.key = newIdempotencyKey();
        this.keyInput = null;
      }
    } finally {
      this.busy.set(false);
    }
  }

  protected back(): void {
    this.ref.close();
  }

  private periodOf(model: ChangePlanModel): PlanPeriodChange | null {
    switch (model.mode) {
      case 'extend':
        return { kind: 'extend', days: model.days };
      case 'until': {
        const activeUntil = this.untilInstant();
        return activeUntil ? { kind: 'until', activeUntil } : null;
      }
      case 'end':
        return { kind: 'until', activeUntil: this.now };
      case 'keep':
        return { kind: 'keep' };
    }
  }
}
