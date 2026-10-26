import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormField, form, maxLength, required } from '@angular/forms/signals';
import { MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { TranslatePipe } from '@ngx-translate/core';
import { ApiError } from '../../../../shared/domain/model/api-error';
import { newIdempotencyKey } from '../../../../shared/domain/model/idempotency-key';
import { BusyButton } from '../../../../shared/presentation/components/busy-button/busy-button';
import { ErrorMessagePipe } from '../../../../shared/presentation/pipes/error-message.pipe';
import { CurrentEstablishment } from '../../../application/current-establishment.store';
import { EstablishmentDetails } from '../../../domain/model/establishment';
import { DEFAULT_TIME_ZONE, timeZoneOptions } from '../establishment-details/time-zones';

/**
 * Opening another establishment, for the owner (O4): closed until its hours are set, and selected once opened.
 * One idempotency key per attempt, reused on a retry after a lost answer and renewed when the form changes.
 */
@Component({
  selector: 'app-open-establishment-dialog',
  imports: [
    BusyButton,
    ErrorMessagePipe,
    FormField,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    TranslatePipe,
  ],
  templateUrl: './open-establishment-dialog.html',
  styleUrls: ['../sheet.scss', './open-establishment-dialog.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OpenEstablishmentDialog {
  private readonly establishment = inject(CurrentEstablishment);
  private readonly ref = inject(MatDialogRef<OpenEstablishmentDialog, boolean>);

  protected readonly model = signal<EstablishmentDetails>({
    name: '',
    address: '',
    timeZone: DEFAULT_TIME_ZONE,
  });
  protected readonly openForm = form(this.model, (path) => {
    required(path.name);
    maxLength(path.name, 120);
    maxLength(path.address, 300);
  });
  protected readonly timeZones = computed(() => timeZoneOptions(this.model().timeZone));
  protected readonly busy = signal(false);
  protected readonly error = signal<ApiError | null>(null);
  private key = newIdempotencyKey();
  private keyInput: string | null = null;

  protected async confirm(event?: Event): Promise<void> {
    event?.preventDefault();
    this.openForm().markAsTouched();
    if (this.busy() || this.openForm().invalid() || !this.model().name.trim()) return;
    const input = JSON.stringify(this.model());
    if (this.keyInput !== null && this.keyInput !== input) this.key = newIdempotencyKey();
    this.keyInput = input;
    this.busy.set(true);
    this.error.set(null);
    try {
      await this.establishment.open(this.model(), this.key);
      this.ref.close(true);
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
    this.ref.close(false);
  }
}
