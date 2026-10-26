import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  isDevMode,
  signal,
} from '@angular/core';
import { FormField, form, required } from '@angular/forms/signals';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { CurrentEstablishment, CurrentOrganization } from '../../../../organization/public-api';
import { ApiError } from '../../../../shared/domain/model/api-error';
import { newIdempotencyKey } from '../../../../shared/domain/model/idempotency-key';
import { BrandMark } from '../../../../shared/presentation/components/brand-mark/brand-mark';
import { BusyButton } from '../../../../shared/presentation/components/busy-button/busy-button';
import { Skeleton } from '../../../../shared/presentation/components/skeleton/skeleton';
import {
  StateKind,
  StateView,
} from '../../../../shared/presentation/components/state-view/state-view';
import { ErrorMessagePipe } from '../../../../shared/presentation/pipes/error-message.pipe';
import { WhatsappLineStore } from '../../../application/whatsapp-line.store';
import { ConnectLine, LineMode, SignupResult } from '../../../domain/model/whatsapp-line';
import { DisconnectLineSheet } from '../disconnect-line-sheet/disconnect-line-sheet';

interface DevSignupModel {
  code: string;
  wabaId: string;
  phoneNumberId: string;
  mode: LineMode;
  pin: string;
}

/** The notification templates pibble creates on the line's account (docs/07 §3). */
const TEMPLATES = ['reminder', 'confirmation', 'cancellation'] as const;

/**
 * Ajustes › WhatsApp and the last step of Primeros pasos, for the owner (03 §5): the line's number, mode, status
 * and template reviews, connecting it through Meta's Embedded Signup (W1, W2) and disconnecting it. Without Takodu's
 * Meta app (`environment.metaSignup`) it says connecting is not set up, and development builds offer a labelled
 * form with the values pibble's dev mode accepts instead. Connecting sends one
 * idempotency key per attempt, reused on a retry after a lost answer; an inactive plan disables it, but not
 * disconnecting (O6).
 */
@Component({
  selector: 'app-line-settings',
  imports: [
    BrandMark,
    BusyButton,
    ErrorMessagePipe,
    FormField,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    Skeleton,
    StateView,
    TranslatePipe,
  ],
  templateUrl: './line-settings.html',
  styleUrl: './line-settings.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LineSettings {
  protected readonly store = inject(WhatsappLineStore);
  protected readonly organization = inject(CurrentOrganization);
  protected readonly establishment = inject(CurrentEstablishment);
  private readonly sheet = inject(MatBottomSheet);
  private readonly translate = inject(TranslateService);

  protected readonly templates = TEMPLATES;
  protected readonly withMeta = this.store.signupAvailable;
  protected readonly devSignup = !this.withMeta && isDevMode();

  protected readonly line = computed(() =>
    this.store.line.hasValue() ? this.store.line.value() : null,
  );
  private readonly loadError = computed(() => {
    const error = this.store.line.error();
    return error ? ApiError.of(error) : null;
  });
  /** W1: the establishment never had a line. */
  protected readonly neverConnected = computed(
    () => this.loadError()?.code === 'WHATSAPP_LINE_NOT_FOUND',
  );
  protected readonly failed = computed(() => (this.neverConnected() ? null : this.loadError()));
  protected readonly errorKind = computed<StateKind>(() => {
    switch (this.failed()?.code) {
      case 'ACCESS_DENIED':
        return 'forbidden';
      case 'NETWORK_ERROR':
        return 'offline';
      default:
        return 'error';
    }
  });
  protected readonly canConnect = computed(() => this.organization.planActive());

  protected readonly devModel = signal<DevSignupModel>({
    code: 'dev-code',
    wabaId: '102290129340398',
    phoneNumberId: '106540352242922',
    mode: 'coexistence',
    pin: '',
  });
  protected readonly devForm = form(this.devModel, (path) => {
    required(path.code);
    required(path.wabaId);
    required(path.phoneNumberId);
  });

  protected readonly busy = signal(false);
  protected readonly error = signal<ApiError | null>(null);
  private key = newIdempotencyKey();
  private keyInput: string | null = null;
  /** What Meta returned, kept to retry with the same key after a lost answer; its code works once. */
  private signup: SignupResult | null = null;

  /** W2: Meta's window, then pibble finishes the signup in coexistence mode. */
  protected async connectWithMeta(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      this.signup ??= await this.store.signUpWithMeta();
      await this.connect({ ...this.signup, mode: 'coexistence' });
    } catch (error) {
      this.failedWith(error);
      if (!ApiError.of(error).retryable) this.signup = null;
    } finally {
      this.busy.set(false);
    }
  }

  /** Development builds only: what pibble's dev mode accepts in place of Meta's window. */
  protected async connectForDevelopment(event?: Event): Promise<void> {
    event?.preventDefault();
    this.devForm().markAsTouched();
    if (this.busy() || this.devForm().invalid()) return;
    const { pin, ...model } = this.devModel();
    this.busy.set(true);
    this.error.set(null);
    try {
      await this.connect(model.mode === 'cloud_api' ? { ...model, pin } : model);
    } catch (error) {
      this.failedWith(error);
    } finally {
      this.busy.set(false);
    }
  }

  protected disconnect(): void {
    const line = this.line();
    if (!line) return;
    this.sheet.open(DisconnectLineSheet, {
      data: line,
      ariaLabel: this.translate.instant('conversations.line.disconnectSheet.title', {
        phone: line.displayPhone,
      }),
    });
  }

  private async connect(command: ConnectLine): Promise<void> {
    const establishmentId = this.establishment.id();
    if (!establishmentId) return;
    const input = JSON.stringify(command);
    if (this.keyInput !== null && this.keyInput !== input) this.key = newIdempotencyKey();
    this.keyInput = input;
    await this.store.connect(establishmentId, command, this.key);
    this.key = newIdempotencyKey();
    this.keyInput = null;
    this.signup = null;
  }

  private failedWith(error: unknown): void {
    const failure = ApiError.of(error);
    this.error.set(failure);
    if (!failure.retryable) {
      this.key = newIdempotencyKey();
      this.keyInput = null;
    }
  }
}
