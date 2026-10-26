import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MAT_BOTTOM_SHEET_DATA, MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe } from '@ngx-translate/core';
import { ApiError } from '../../../../shared/domain/model/api-error';
import { BusyButton } from '../../../../shared/presentation/components/busy-button/busy-button';
import { ErrorMessagePipe } from '../../../../shared/presentation/pipes/error-message.pipe';
import { WhatsappLineStore } from '../../../application/whatsapp-line.store';
import { WhatsappLine } from '../../../domain/model/whatsapp-line';

/**
 * Disconnecting the establishment's line, for the owner (W1): conversations stay and connecting the same number
 * again reuses them. A DELETE repeats safely, so it sends no idempotency key.
 */
@Component({
  selector: 'app-disconnect-line-sheet',
  imports: [BusyButton, ErrorMessagePipe, MatButtonModule, MatIconModule, TranslatePipe],
  templateUrl: './disconnect-line-sheet.html',
  styleUrl: './disconnect-line-sheet.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DisconnectLineSheet {
  private readonly store = inject(WhatsappLineStore);
  private readonly ref = inject(MatBottomSheetRef<DisconnectLineSheet, boolean>);
  protected readonly line = inject<WhatsappLine>(MAT_BOTTOM_SHEET_DATA);

  protected readonly busy = signal(false);
  protected readonly error = signal<ApiError | null>(null);

  protected async confirm(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      await this.store.disconnect(this.line.establishmentId);
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
