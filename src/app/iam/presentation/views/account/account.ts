import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { ApiError } from '../../../../shared/domain/model/api-error';
import { Avatar } from '../../../../shared/presentation/components/avatar/avatar';
import { BusyButton } from '../../../../shared/presentation/components/busy-button/busy-button';
import { Skeleton } from '../../../../shared/presentation/components/skeleton/skeleton';
import {
  StateKind,
  StateView,
} from '../../../../shared/presentation/components/state-view/state-view';
import { ErrorMessagePipe } from '../../../../shared/presentation/pipes/error-message.pipe';
import { ZonedDatePipe } from '../../../../shared/presentation/pipes/zoned-date.pipe';
import { ACCOUNT_WORKSPACE } from '../../../application/account-workspace';
import { PLATFORM_ENTRY } from '../../../application/platform-entry';
import { AccountSessionsStore } from '../../../application/account-sessions.store';
import { SessionStore } from '../../../application/session.store';
import { AccountSession } from '../../../domain/model/account-session';

const LIMA = 'America/Lima';

/**
 * Cuenta, a section of the settings center for every role: who is signed in (I1), the devices with an open session and signing one out
 * (I5), another organization, the Takodu team's area for operators, and signing out. pibble has no endpoint to
 * edit the user, so the name is read-only. Times show in the selected establishment's zone, which the app's routes
 * provide.
 */
@Component({
  selector: 'app-account',
  imports: [
    Avatar,
    BusyButton,
    ErrorMessagePipe,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    RouterLink,
    Skeleton,
    StateView,
    TranslatePipe,
    ZonedDatePipe,
  ],
  templateUrl: './account.html',
  styleUrl: './account.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Account {
  protected readonly session = inject(SessionStore);
  protected readonly store = inject(AccountSessionsStore);
  protected readonly workspace = inject(ACCOUNT_WORKSPACE);
  protected readonly platform = inject(PLATFORM_ENTRY);

  protected readonly timeZone = computed(() => this.workspace.timeZone() ?? LIMA);
  protected readonly loadError = computed(() => {
    const error = this.store.sessions.error();
    return error ? ApiError.of(error) : null;
  });
  protected readonly errorKind = computed<StateKind>(() =>
    this.loadError()?.code === 'NETWORK_ERROR' ? 'offline' : 'error',
  );

  /** The device being signed out, and what happened to the last one. */
  protected readonly ending = signal<string | null>(null);
  protected readonly ended = signal<{ id: string; error: ApiError | null } | null>(null);

  protected async signOutDevice(device: AccountSession): Promise<void> {
    if (this.ending()) return;
    this.ending.set(device.id);
    this.ended.set(null);
    try {
      await this.store.signOut(device);
      this.ended.set({ id: device.id, error: null });
    } catch (error) {
      const failure = ApiError.of(error);
      this.ended.set({ id: device.id, error: failure });
      if (failure.code === 'SESSION_NOT_FOUND') this.store.sessions.reload();
    } finally {
      this.ending.set(null);
    }
  }

  protected async signOut(): Promise<void> {
    await this.session.signOut();
  }
}
