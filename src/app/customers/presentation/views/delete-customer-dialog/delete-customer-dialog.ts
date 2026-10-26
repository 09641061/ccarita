import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe } from '@ngx-translate/core';
import { ApiError } from '../../../../shared/domain/model/api-error';
import { BusyButton } from '../../../../shared/presentation/components/busy-button/busy-button';
import { ErrorMessagePipe } from '../../../../shared/presentation/pipes/error-message.pipe';
import { CustomerDetailStore } from '../../../application/customer-detail.store';
import { CustomerProfile } from '../../../domain/model/customer-profile';

/**
 * Deleting a customer (C5), for owners and managers (C3): what stays and what goes. Dismisses with `true` once
 * pibble deleted it. A DELETE needs no idempotency key: repeating it changes nothing.
 */
@Component({
  selector: 'app-delete-customer-dialog',
  imports: [BusyButton, ErrorMessagePipe, MatButtonModule, MatIconModule, TranslatePipe],
  templateUrl: './delete-customer-dialog.html',
  styleUrl: '../dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeleteCustomerDialog {
  private readonly store = inject(CustomerDetailStore);
  private readonly ref = inject(MatDialogRef<DeleteCustomerDialog, boolean>);
  protected readonly customer = inject<CustomerProfile>(MAT_DIALOG_DATA);

  protected readonly busy = signal(false);
  protected readonly error = signal<ApiError | null>(null);

  protected async confirm(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      await this.store.delete(this.customer.id);
      this.ref.close(true);
    } catch (error) {
      this.error.set(ApiError.of(error));
    } finally {
      this.busy.set(false);
    }
  }

  protected back(): void {
    this.ref.close(false);
  }
}
