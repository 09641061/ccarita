import { BreakpointObserver } from '@angular/cdk/layout';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterLink, RouterOutlet } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { map } from 'rxjs';
import { ApiError } from '../../../../shared/domain/model/api-error';
import { Avatar } from '../../../../shared/presentation/components/avatar/avatar';
import { Skeleton } from '../../../../shared/presentation/components/skeleton/skeleton';
import {
  StateKind,
  StateView,
} from '../../../../shared/presentation/components/state-view/state-view';
import { CustomerDetailStore } from '../../../application/customer-detail.store';
import { CustomerListStore, LIST_PAGE_SIZE } from '../../../application/customer-list.store';

/**
 * Clientes: active customers by name, searched by name or phone, a page at a time without a total. A customer's
 * detail and form open beside the list on desktops and in its place on phones. Every role sees it, also on an
 * inactive plan (C3).
 */
@Component({
  selector: 'app-customer-list',
  imports: [
    Avatar,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    RouterLink,
    RouterOutlet,
    Skeleton,
    StateView,
    TranslatePipe,
  ],
  templateUrl: './customer-list.html',
  styleUrl: './customer-list.scss',
  host: { '[class.detail-open]': 'detailOpen()', '[class.desktop]': 'desktop()' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerList {
  protected readonly store = inject(CustomerListStore);
  protected readonly detail = inject(CustomerDetailStore);

  protected readonly desktop = toSignal(
    inject(BreakpointObserver)
      .observe('(min-width: 1024px)')
      .pipe(map((state) => state.matches)),
    { initialValue: false },
  );
  protected readonly detailOpen = signal(false);

  protected readonly page = computed(() =>
    this.store.results.hasValue() ? this.store.results.value() : null,
  );
  /** The positions shown, such as 21 – 40; pibble counts no total. */
  protected readonly range = computed(() => {
    const page = this.page();
    if (!page || page.items.length === 0) return null;
    const from = page.page * LIST_PAGE_SIZE + 1;
    return { from, to: from + page.items.length - 1 };
  });
  protected readonly loadError = computed(() => {
    const error = this.store.results.error();
    return error ? ApiError.of(error) : null;
  });
  protected readonly errorKind = computed<StateKind>(() => {
    const code = this.loadError()?.code;
    if (code === 'NETWORK_ERROR') return 'offline';
    if (code === 'ACCESS_DENIED') return 'forbidden';
    return 'error';
  });

  protected type(query: string): void {
    this.store.search(query);
  }
}
