import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  isDevMode,
  signal,
} from '@angular/core';
import { email, form, FormField, required } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { ApiError } from '../../../../shared/domain/model/api-error';
import { BusyButton } from '../../../../shared/presentation/components/busy-button/busy-button';
import { StateView } from '../../../../shared/presentation/components/state-view/state-view';
import { safeReturnUrl } from '../../../../shared/presentation/navigation/return-url';
import { ErrorMessagePipe } from '../../../../shared/presentation/pipes/error-message.pipe';
import { SessionStore } from '../../../application/session.store';
import { CodeInput } from '../../components/code-input/code-input';
import { Wordmark } from '../../../../shared/presentation/components/wordmark/wordmark';

/**
 * Passwordless sign-in (I2, Ingreso con código): the email, then the 6-digit code pibble emails. Afterwards it goes
 * back to `volver`. With a stored refresh token it first tries to restore the session.
 */
@Component({
  selector: 'app-sign-in',
  imports: [
    Wordmark,
    BusyButton,
    CodeInput,
    ErrorMessagePipe,
    FormField,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    StateView,
    TranslatePipe,
  ],
  templateUrl: './sign-in.html',
  styleUrl: './sign-in.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SignIn {
  private readonly store = inject(SessionStore);
  private readonly router = inject(Router);

  /** Where to go after signing in, from `?volver=`. */
  readonly volver = input<string>();

  protected readonly step = signal<'email' | 'code'>('email');
  protected readonly account = signal({ email: '' });
  protected readonly accountForm = form(this.account, (path) => {
    required(path.email);
    email(path.email);
  });
  protected readonly code = signal('');
  protected readonly busy = signal(false);
  protected readonly error = signal<ApiError | null>(null);
  protected readonly resent = signal(false);
  protected readonly resuming = signal(false);
  protected readonly resumeFailed = signal(false);
  /** pibble's dev mode prints the code in its console instead of emailing it. */
  protected readonly devHint = isDevMode();

  constructor() {
    if (this.store.canResume) void this.resume();
  }

  protected async resume(): Promise<void> {
    this.resuming.set(true);
    this.resumeFailed.set(false);
    try {
      if (await this.store.restore()) await this.continue();
    } catch {
      this.resumeFailed.set(true);
    } finally {
      this.resuming.set(false);
    }
  }

  protected useAnotherEmail(): void {
    this.resumeFailed.set(false);
  }

  protected async sendCode(event?: Event): Promise<void> {
    event?.preventDefault();
    this.accountForm().markAsTouched();
    if (this.accountForm().invalid() || this.busy()) return;
    if (await this.run(() => this.store.requestCode(this.normalizedEmail()))) {
      this.code.set('');
      this.resent.set(false);
      this.step.set('code');
    }
  }

  protected async resend(): Promise<void> {
    if (this.busy()) return;
    this.resent.set(false);
    if (await this.run(() => this.store.requestCode(this.normalizedEmail()))) this.resent.set(true);
  }

  protected async enter(event?: Event): Promise<void> {
    event?.preventDefault();
    if (this.code().length !== 6 || this.busy()) return;
    if (await this.run(() => this.store.signIn(this.normalizedEmail(), this.code())))
      await this.continue();
  }

  protected changeEmail(): void {
    this.error.set(null);
    this.step.set('email');
  }

  protected normalizedEmail(): string {
    return this.account().email.trim().toLowerCase();
  }

  private async run(action: () => Promise<void>): Promise<boolean> {
    this.busy.set(true);
    this.error.set(null);
    try {
      await action();
      return true;
    } catch (error) {
      this.error.set(ApiError.of(error));
      return false;
    } finally {
      this.busy.set(false);
    }
  }

  private async continue(): Promise<void> {
    await this.router.navigateByUrl(safeReturnUrl(this.volver()));
  }
}
