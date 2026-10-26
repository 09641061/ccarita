import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormField, form, maxLength, required } from '@angular/forms/signals';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { TranslatePipe } from '@ngx-translate/core';
import { ApiError } from '../../../../shared/domain/model/api-error';
import { newIdempotencyKey } from '../../../../shared/domain/model/idempotency-key';
import { BusyButton } from '../../../../shared/presentation/components/busy-button/busy-button';
import { ErrorMessagePipe } from '../../../../shared/presentation/pipes/error-message.pipe';
import { ZonedDatePipe } from '../../../../shared/presentation/pipes/zoned-date.pipe';
import { CalendarStore } from '../../../application/calendar.store';
import { Appointment, CancelledBy } from '../../../domain/model/appointment';

export interface CancelDialogData {
  readonly appointment: Appointment;
  readonly customerName: string;
  readonly serviceName: string;
  readonly memberName: string;
  readonly timeZone: string;
}

/**
 * Cancelling an appointment (B12): who asked and why. When the business cancels, pibble tells the customer the
 * reason on WhatsApp (W13); when the customer asked, it does not.
 */
@Component({
  selector: 'app-cancel-dialog',
  imports: [
    BusyButton,
    ErrorMessagePipe,
    FormField,
    MatButtonModule,
    MatButtonToggleModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    TranslatePipe,
    ZonedDatePipe,
  ],
  templateUrl: './cancel-dialog.html',
  styleUrl: '../dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CancelDialog {
  private readonly store = inject(CalendarStore);
  private readonly ref = inject(MatDialogRef<CancelDialog, Appointment>);
  protected readonly data = inject<CancelDialogData>(MAT_DIALOG_DATA);

  protected readonly model = signal({ cancelledBy: 'staff' as CancelledBy, reason: '' });
  protected readonly cancelForm = form(this.model, (path) => {
    required(path.reason);
    maxLength(path.reason, 500);
  });
  protected readonly busy = signal(false);
  protected readonly error = signal<ApiError | null>(null);
  private key = newIdempotencyKey();
  private keyInput: string | null = null;

  protected chooseWho(cancelledBy: CancelledBy): void {
    this.model.update((model) => ({ ...model, cancelledBy }));
  }

  protected async confirm(event?: Event): Promise<void> {
    event?.preventDefault();
    this.cancelForm().markAsTouched();
    if (!this.model().reason.trim()) return;
    if (this.cancelForm().invalid() || this.busy()) return;
    const input = JSON.stringify(this.model());
    if (this.keyInput !== null && this.keyInput !== input) this.key = newIdempotencyKey();
    this.keyInput = input;
    this.busy.set(true);
    this.error.set(null);
    try {
      this.ref.close(await this.store.cancel(this.data.appointment, this.model(), this.key));
    } catch (error) {
      this.error.set(ApiError.of(error));
    } finally {
      this.busy.set(false);
    }
  }

  protected back(): void {
    this.ref.close();
  }
}
