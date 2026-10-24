import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { FormField, form, maxLength, required } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { ApiError } from '../../../../shared/domain/model/api-error';
import { newIdempotencyKey } from '../../../../shared/domain/model/idempotency-key';
import { BusyButton } from '../../../../shared/presentation/components/busy-button/busy-button';
import { Skeleton } from '../../../../shared/presentation/components/skeleton/skeleton';
import {
  StateKind,
  StateView,
} from '../../../../shared/presentation/components/state-view/state-view';
import { ErrorMessagePipe } from '../../../../shared/presentation/pipes/error-message.pipe';
import { CustomerDetailStore } from '../../../application/customer-detail.store';
import { CustomerDetails, missingDocumentPart } from '../../../domain/model/customer-details';
import { DOCUMENT_TYPES, DocumentType } from '../../../domain/model/identity-document';

interface CustomerFormModel {
  phone: string;
  name: string;
  /** '' is no document. */
  documentType: DocumentType | '';
  documentNumber: string;
  notes: string;
}

const EMPTY: CustomerFormModel = {
  phone: '',
  name: '',
  documentType: '',
  documentNumber: '',
  notes: '',
};

/**
 * Registering a customer by phone (`clientes/nuevo`), or editing what staff typed (`clientes/:id/editar`): name,
 * document and notes, all optional (C3, C4). The phone is typed once and never changes (C1). Editing sends the
 * whole form, because pibble clears what is left out; registering sends one idempotency key per attempt.
 */
@Component({
  selector: 'app-customer-form',
  imports: [
    BusyButton,
    ErrorMessagePipe,
    FormField,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    RouterLink,
    Skeleton,
    StateView,
    TranslatePipe,
  ],
  templateUrl: './customer-form.html',
  styleUrl: './customer-form.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerForm {
  protected readonly store = inject(CustomerDetailStore);
  private readonly router = inject(Router);

  /** From the route `clientes/:customerId/editar`; absent when registering. */
  readonly customerId = input<string>();

  protected readonly documentTypes = DOCUMENT_TYPES;
  protected readonly editing = computed(() => !!this.customerId());
  protected readonly profile = computed(() => {
    const profile = this.store.profile.hasValue() ? this.store.profile.value() : null;
    return profile && profile.id === this.customerId() ? profile : null;
  });
  protected readonly loadError = computed(() => {
    const error = this.editing() ? this.store.profile.error() : undefined;
    return error ? ApiError.of(error) : null;
  });
  protected readonly errorKind = computed<StateKind>(() => {
    switch (this.loadError()?.code) {
      case 'CUSTOMER_NOT_FOUND':
        return 'notFound';
      case 'NETWORK_ERROR':
        return 'offline';
      default:
        return 'error';
    }
  });

  protected readonly model = signal<CustomerFormModel>(EMPTY);
  protected readonly customerForm = form(this.model, (path) => {
    required(path.phone, { when: () => !this.editing() });
    maxLength(path.phone, 30);
    maxLength(path.name, 120);
    maxLength(path.documentNumber, 20);
    maxLength(path.notes, 2000);
  });
  protected readonly missingDocument = computed(() => missingDocumentPart(this.details()));
  protected readonly busy = signal(false);
  protected readonly error = signal<ApiError | null>(null);
  private key = newIdempotencyKey();
  private keyInput: string | null = null;
  /** The customer whose profile filled the form, so a reload does not overwrite what is being typed. */
  private filledFor: string | null = null;

  private readonly details = computed<CustomerDetails>(() => {
    const model = this.model();
    return {
      name: model.name,
      documentType: model.documentType || null,
      documentNumber: model.documentNumber,
      notes: model.notes,
    };
  });

  constructor() {
    effect(() => {
      const id = this.customerId() ?? null;
      untracked(() => {
        if (id) this.store.open(id);
        this.filledFor = null;
        this.model.set(EMPTY);
        this.error.set(null);
      });
    });
    effect(() => {
      const profile = this.profile();
      if (!profile || this.filledFor === profile.id) return;
      this.filledFor = profile.id;
      untracked(() =>
        this.model.set({
          ...profile.details,
          phone: profile.phone,
          documentType: profile.details.documentType ?? '',
        }),
      );
    });
    inject(DestroyRef).onDestroy(() => {
      if (this.customerId()) this.store.open(null);
    });
  }

  /** Where cancelling and saving lead: the customer, or the list when registering was cancelled. */
  protected readonly leaveLink = computed(() =>
    this.customerId() ? ['/clientes', this.customerId()!] : ['/clientes'],
  );

  protected async save(event?: Event): Promise<void> {
    event?.preventDefault();
    this.customerForm().markAsTouched();
    if (this.busy() || this.customerForm().invalid() || this.missingDocument()) return;
    if (!this.editing() && !this.model().phone.trim()) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      const id = this.customerId();
      const saved = id ? await this.store.update(id, this.details()) : await this.register();
      void this.router.navigate(['/clientes', saved.id]);
    } catch (error) {
      const failure = ApiError.of(error);
      this.error.set(failure);
      if (!failure.retryable) this.keyInput = null;
    } finally {
      this.busy.set(false);
    }
  }

  /** C1, C3. A retry after a lost answer sends the same key, so the customer is registered once. */
  private async register() {
    const input = JSON.stringify(this.model());
    if (this.keyInput !== null && this.keyInput !== input) this.key = newIdempotencyKey();
    this.keyInput = input;
    const details = this.details();
    const profile = await this.store.register(
      { ...details, phone: this.model().phone, name: details.name || null },
      this.key,
    );
    this.key = newIdempotencyKey();
    this.keyInput = null;
    return profile;
  }
}
