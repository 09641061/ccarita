import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MAT_BOTTOM_SHEET_DATA, MatBottomSheetRef } from '@angular/material/bottom-sheet';
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
  selector: 'app-delete-customer-sheet',
  imports: [BusyButton, ErrorMessagePipe, MatButtonModule, MatIconModule, TranslatePipe],
  templateUrl: './delete-customer-sheet.html',
  styleUrl: '../sheet.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeleteCustomerSheet {
  private readonly store = inject(CustomerDetailStore);
  private readonly ref = inject(MatBottomSheetRef<DeleteCustomerSheet, boolean>);
  protected readonly customer = inject<CustomerProfile>(MAT_BOTTOM_SHEET_DATA);

  protected readonly busy = signal(false);
  protected readonly error = signal<ApiError | null>(null);

  protected async confirm(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      await this.store.delete(this.customer.id);
      this.ref.dismiss(true);
    } catch (error) {
      this.error.set(ApiError.of(error));
    } finally {
      this.busy.set(false);
    }
  }

  protected back(): void {
    this.ref.dismiss(false);
  }
}
