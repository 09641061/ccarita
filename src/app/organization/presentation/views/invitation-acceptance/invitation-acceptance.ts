import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { SessionStore } from '../../../../iam/public-api';
import { ApiError } from '../../../../shared/domain/model/api-error';
import { BusyButton } from '../../../../shared/presentation/components/busy-button/busy-button';
import {
  StateKind,
  StateView,
} from '../../../../shared/presentation/components/state-view/state-view';
import { ErrorMessagePipe } from '../../../../shared/presentation/pipes/error-message.pipe';
import { CurrentOrganization } from '../../../application/current-organization.store';

interface Failure {
  readonly kind: StateKind;
  /** Translation keys under `organization.invitation`, or none for the generic state. */
  readonly texts?: 'expired' | 'otherEmail' | 'invalid' | 'taken';
}

/**
 * The link pibble emails (`APP_URL/invitations/{token}`, O10). The user signs in first (`authGuard` brings them
 * back), then accepts; the organization is selected and the calendar opens. pibble does not return the invited
 * email, so the wrong-email state shows only the signed-in one.
 */
@Component({
  selector: 'app-invitation-acceptance',
  imports: [BusyButton, ErrorMessagePipe, MatButtonModule, StateView, TranslatePipe],
  templateUrl: './invitation-acceptance.html',
  styleUrl: './invitation-acceptance.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InvitationAcceptance {
  private readonly router = inject(Router);
  private readonly organization = inject(CurrentOrganization);
  protected readonly session = inject(SessionStore);

  /** The invitation token from the link. */
  readonly token = input.required<string>();

  protected readonly busy = signal(false);
  protected readonly error = signal<ApiError | null>(null);
  protected readonly failure = computed<Failure | null>(() => {
    const error = this.error();
    if (!error) return null;
    switch (error.code) {
      case 'INVITATION_EXPIRED':
        return { kind: 'notFound', texts: 'expired' };
      case 'ACCESS_DENIED':
        return { kind: 'forbidden', texts: 'otherEmail' };
      case 'INVITATION_NOT_FOUND':
      case 'INVITATION_NOT_PENDING':
        return { kind: 'notFound', texts: 'invalid' };
      case 'INVITATION_CONFLICT':
        return { kind: 'forbidden', texts: 'taken' };
      default:
        return { kind: error.code === 'NETWORK_ERROR' ? 'offline' : 'error' };
    }
  });

  protected async accept(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      await this.organization.acceptInvitation(this.token());
      await this.router.navigateByUrl('/agenda');
    } catch (error) {
      this.error.set(ApiError.of(error));
    } finally {
      this.busy.set(false);
    }
  }

  /** Signs out and back in with another email, returning to this invitation. */
  protected async switchAccount(): Promise<void> {
    await this.session.signOut();
    await this.router.navigate(['/ingresar'], {
      queryParams: { volver: `/invitations/${this.token()}` },
    });
  }
}
