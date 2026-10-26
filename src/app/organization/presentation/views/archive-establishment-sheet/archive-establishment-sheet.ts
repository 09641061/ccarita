import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MAT_BOTTOM_SHEET_DATA, MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe } from '@ngx-translate/core';
import { ApiError } from '../../../../shared/domain/model/api-error';
import { BusyButton } from '../../../../shared/presentation/components/busy-button/busy-button';
import { ErrorMessagePipe } from '../../../../shared/presentation/pipes/error-message.pipe';
import { CurrentEstablishment } from '../../../application/current-establishment.store';
import { Establishment } from '../../../domain/model/establishment';

/**
 * Archiving an establishment, for the owner (O4): it frees its place in the plan and keeps its history, also while
 * the plan is inactive (O6). Archiving twice changes nothing, so it sends no idempotency key.
 */
@Component({
  selector: 'app-archive-establishment-sheet',
  imports: [BusyButton, ErrorMessagePipe, MatButtonModule, MatIconModule, TranslatePipe],
  templateUrl: './archive-establishment-sheet.html',
  styleUrl: '../sheet.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ArchiveEstablishmentSheet {
  private readonly establishment = inject(CurrentEstablishment);
  private readonly ref = inject(MatBottomSheetRef<ArchiveEstablishmentSheet, boolean>);
  protected readonly target = inject<Establishment>(MAT_BOTTOM_SHEET_DATA);

  protected readonly busy = signal(false);
  protected readonly error = signal<ApiError | null>(null);

  protected async confirm(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      await this.establishment.archive(this.target.id);
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
