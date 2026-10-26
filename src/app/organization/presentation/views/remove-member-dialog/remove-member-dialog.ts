import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { TranslatePipe } from '@ngx-translate/core';
import { ApiError } from '../../../../shared/domain/model/api-error';
import { BusyButton } from '../../../../shared/presentation/components/busy-button/busy-button';
import { ErrorMessagePipe } from '../../../../shared/presentation/pipes/error-message.pipe';
import { TeamStore } from '../../../application/team.store';
import { Member } from '../../../domain/model/member';

/**
 * Removing a member or revoking a pending invitation (O10, O12), also with an inactive plan (O6). History is kept.
 * Removing twice changes nothing, so the DELETE sends no idempotency key.
 */
@Component({
  selector: 'app-remove-member-dialog',
  imports: [BusyButton, ErrorMessagePipe, MatButtonModule, TranslatePipe],
  templateUrl: './remove-member-dialog.html',
  styleUrl: '../dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RemoveMemberDialog {
  private readonly store = inject(TeamStore);
  private readonly ref = inject(MatDialogRef<RemoveMemberDialog, boolean>);
  protected readonly target = inject<Member>(MAT_DIALOG_DATA);
  protected readonly revoking = this.target.status === 'pending';

  protected readonly busy = signal(false);
  protected readonly error = signal<ApiError | null>(null);

  protected async confirm(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      await this.store.remove(this.target.id);
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
