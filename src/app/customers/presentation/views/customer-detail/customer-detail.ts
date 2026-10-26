import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  untracked,
} from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ApiError } from '../../../../shared/domain/model/api-error';
import { Avatar } from '../../../../shared/presentation/components/avatar/avatar';
import { Skeleton } from '../../../../shared/presentation/components/skeleton/skeleton';
import {
  StateKind,
  StateView,
} from '../../../../shared/presentation/components/state-view/state-view';
import { CUSTOMER_ACCESS } from '../../../application/customer-access';
import { CustomerDetailStore } from '../../../application/customer-detail.store';
import { DeleteCustomerDialog } from '../delete-customer-dialog/delete-customer-dialog';
import { DIALOG_OPTIONS } from '../../../../shared/presentation/dialog-options';

/**
 * Detalle de cliente: phone, WhatsApp name, document and notes (C1, C2, C4), editing for every role and deleting
 * for owners and managers (C3, C5). Booking for the customer waits for an active plan (O6); the rest does not.
 */
@Component({
  selector: 'app-customer-detail',
  imports: [Avatar, MatButtonModule, MatIconModule, RouterLink, Skeleton, StateView, TranslatePipe],
  templateUrl: './customer-detail.html',
  styleUrl: './customer-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerDetail {
  protected readonly store = inject(CustomerDetailStore);
  protected readonly access = inject(CUSTOMER_ACCESS);
  private readonly dialog = inject(MatDialog);
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);

  /** From the route `clientes/:customerId`. */
  readonly customerId = input.required<string>();

  protected readonly profile = computed(() => {
    const profile = this.store.profile.hasValue() ? this.store.profile.value() : null;
    return profile?.id === this.customerId() ? profile : null;
  });
  protected readonly loadError = computed(() => {
    const error = this.store.profile.error();
    return error ? ApiError.of(error) : null;
  });
  protected readonly errorKind = computed<StateKind>(() => {
    switch (this.loadError()?.code) {
      case 'CUSTOMER_NOT_FOUND':
        return 'notFound';
      case 'ACCESS_DENIED':
        return 'forbidden';
      case 'NETWORK_ERROR':
        return 'offline';
      default:
        return 'error';
    }
  });

  constructor() {
    effect(() => {
      const id = this.customerId();
      untracked(() => this.store.open(id));
    });
    inject(DestroyRef).onDestroy(() => this.store.open(null));
  }

  protected remove(): void {
    const profile = this.profile();
    if (!profile) return;
    this.dialog
      .open(DeleteCustomerDialog, {
        ...DIALOG_OPTIONS,
        data: profile,
        ariaLabel: this.translate.instant('customers.delete.title', { name: profile.displayName }),
      })
      .afterClosed()
      .subscribe((deleted) => {
        if (deleted) void this.router.navigateByUrl('/clientes');
      });
  }
}
