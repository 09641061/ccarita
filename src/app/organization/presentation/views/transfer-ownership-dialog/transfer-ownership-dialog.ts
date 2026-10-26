import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatRadioModule } from '@angular/material/radio';
import { TranslatePipe } from '@ngx-translate/core';
import { ApiError } from '../../../../shared/domain/model/api-error';
import { newIdempotencyKey } from '../../../../shared/domain/model/idempotency-key';
import { BusyButton } from '../../../../shared/presentation/components/busy-button/busy-button';
import { ErrorMessagePipe } from '../../../../shared/presentation/pipes/error-message.pipe';
import { TeamStore } from '../../../application/team.store';
import { Member } from '../../../domain/model/member';

/**
 * The owner hands the organization to a member who joined (O12): choose them, then confirm knowing the caller
 * becomes a manager. One idempotency key per chosen member, reused on a retry after a lost answer. Dismisses with
 * the new owner.
 */
@Component({
  selector: 'app-transfer-ownership-dialog',
  imports: [
    BusyButton,
    ErrorMessagePipe,
    MatButtonModule,
    MatIconModule,
    MatRadioModule,
    TranslatePipe,
  ],
  templateUrl: './transfer-ownership-dialog.html',
  styleUrls: ['../dialog.scss', './transfer-ownership-dialog.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TransferOwnershipDialog {
  private readonly store = inject(TeamStore);
  private readonly ref = inject(MatDialogRef<TransferOwnershipDialog, Member>);
  /** O12: the active members other than the owner. */
  protected readonly candidates = inject<readonly Member[]>(MAT_DIALOG_DATA);

  protected readonly chosen = signal<Member | null>(null);
  protected readonly confirming = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal<ApiError | null>(null);
  private key = newIdempotencyKey();
  private keyFor: string | null = null;

  protected choose(memberId: string): void {
    this.chosen.set(this.candidates.find((m) => m.id === memberId) ?? null);
  }

  protected next(): void {
    if (this.chosen()) this.confirming.set(true);
  }

  protected back(): void {
    if (this.busy()) return;
    if (this.confirming()) {
      this.confirming.set(false);
      this.error.set(null);
    } else {
      this.ref.close();
    }
  }

  protected async confirm(): Promise<void> {
    const member = this.chosen();
    if (!member || this.busy()) return;
    if (this.keyFor !== null && this.keyFor !== member.id) this.key = newIdempotencyKey();
    this.keyFor = member.id;
    this.busy.set(true);
    this.error.set(null);
    try {
      const owner = await this.store.transferOwnership(member.id, this.key);
      this.ref.close(owner);
    } catch (error) {
      const failure = ApiError.of(error);
      this.error.set(failure);
      if (!failure.retryable) {
        this.key = newIdempotencyKey();
        this.keyFor = null;
      }
    } finally {
      this.busy.set(false);
    }
  }
}
