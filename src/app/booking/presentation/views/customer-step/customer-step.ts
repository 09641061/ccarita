import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  output,
  signal,
} from '@angular/core';
import { FormField, form, maxLength, required } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { TranslatePipe } from '@ngx-translate/core';
import { Customer, CustomerSearch } from '../../../../customers/public-api';
import { ApiError } from '../../../../shared/domain/model/api-error';
import { newIdempotencyKey } from '../../../../shared/domain/model/idempotency-key';
import { Avatar } from '../../../../shared/presentation/components/avatar/avatar';
import { BusyButton } from '../../../../shared/presentation/components/busy-button/busy-button';
import { Skeleton } from '../../../../shared/presentation/components/skeleton/skeleton';
import {
  StateKind,
  StateView,
} from '../../../../shared/presentation/components/state-view/state-view';
import { ErrorMessagePipe } from '../../../../shared/presentation/pipes/error-message.pipe';

/**
 * The first step of booking: find the customer by name or phone, or register them by phone in place (C1, C3).
 * Registering works on an inactive plan, like in pibble.
 */
@Component({
  selector: 'app-customer-step',
  imports: [
    Avatar,
    BusyButton,
    ErrorMessagePipe,
    FormField,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    Skeleton,
    StateView,
    TranslatePipe,
  ],
  templateUrl: './customer-step.html',
  styleUrl: './customer-step.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerStep {
  protected readonly search = inject(CustomerSearch);
  readonly chosen = output<Customer>();

  protected readonly page = computed(() =>
    this.search.results.hasValue() ? this.search.results.value() : null,
  );
  protected readonly loadError = computed(() => {
    const error = this.search.results.error();
    return error ? ApiError.of(error) : null;
  });
  protected readonly errorKind = computed<StateKind>(() =>
    this.loadError()?.code === 'NETWORK_ERROR' ? 'offline' : 'error',
  );

  protected readonly registering = signal(false);
  protected readonly model = signal({ phone: '', name: '' });
  protected readonly registerForm = form(this.model, (path) => {
    required(path.phone);
    maxLength(path.phone, 30);
    maxLength(path.name, 120);
  });
  protected readonly busy = signal(false);
  protected readonly error = signal<ApiError | null>(null);
  private key = newIdempotencyKey();
  private keyInput: string | null = null;

  protected type(query: string): void {
    this.search.search(query);
  }

  /** Opens the form, with the typed digits as the phone or the typed words as the name. */
  protected startRegistering(): void {
    const query = this.search.query().trim();
    const isPhone = /^[+\d\s-]+$/.test(query);
    this.model.set({ phone: isPhone ? query : '', name: isPhone ? '' : query });
    this.error.set(null);
    this.registering.set(true);
  }

  protected stopRegistering(): void {
    this.registering.set(false);
  }

  /** C3. A retry after a lost answer sends the same key, so the customer is registered once. */
  protected async register(event?: Event): Promise<void> {
    event?.preventDefault();
    this.registerForm().markAsTouched();
    const { phone, name } = this.model();
    if (!phone.trim() || this.registerForm().invalid() || this.busy()) return;
    const input = JSON.stringify(this.model());
    if (this.keyInput !== null && this.keyInput !== input) this.key = newIdempotencyKey();
    this.keyInput = input;
    this.busy.set(true);
    this.error.set(null);
    try {
      const customer = await this.search.register({ phone, name: name || null }, this.key);
      this.key = newIdempotencyKey();
      this.keyInput = null;
      this.registering.set(false);
      this.chosen.emit(customer);
    } catch (error) {
      const failure = ApiError.of(error);
      this.error.set(failure);
      if (!failure.retryable) this.keyInput = null;
      if (failure.code === 'CUSTOMER_CONFLICT') this.search.search(phone.replace(/\D/g, ''));
    } finally {
      this.busy.set(false);
    }
  }
}
