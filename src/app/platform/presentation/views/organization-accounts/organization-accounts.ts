import { BreakpointObserver } from '@angular/cdk/layout';
import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { map } from 'rxjs';
import { ApiError } from '../../../../shared/domain/model/api-error';
import { Skeleton } from '../../../../shared/presentation/components/skeleton/skeleton';
import {
  StateKind,
  StateView,
} from '../../../../shared/presentation/components/state-view/state-view';
import { ZonedDatePipe } from '../../../../shared/presentation/pipes/zoned-date.pipe';
import { OrganizationAccountsStore } from '../../../application/organization-accounts.store';
import { OPERATOR_TIME_ZONE } from '../../../domain/model/organization-account';

/**
 * Organizaciones (`/platform`), for the Takodu team: every business with its plan, the end of its paid period in
 * Lima, and its open establishments against the plan's limit (O4, O5), in pibble's order (ending soonest first).
 * The search narrows by business name or owner email.
 */
@Component({
  selector: 'app-organization-accounts',
  imports: [
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    NgTemplateOutlet,
    RouterLink,
    Skeleton,
    StateView,
    TranslatePipe,
    ZonedDatePipe,
  ],
  templateUrl: './organization-accounts.html',
  styleUrls: ['../platform.scss', './organization-accounts.scss'],
  host: { '[class.desktop]': 'desktop()' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrganizationAccounts {
  protected readonly store = inject(OrganizationAccountsStore);
  protected readonly timeZone = OPERATOR_TIME_ZONE;

  protected readonly desktop = toSignal(
    inject(BreakpointObserver)
      .observe('(min-width: 1024px)')
      .pipe(map((state) => state.matches)),
    { initialValue: false },
  );

  protected readonly loadError = computed(() => {
    const error = this.store.accounts.error();
    return error ? ApiError.of(error) : null;
  });
  protected readonly errorKind = computed<StateKind>(() => {
    switch (this.loadError()?.code) {
      case 'ACCESS_DENIED':
        return 'forbidden';
      case 'NETWORK_ERROR':
        return 'offline';
      default:
        return 'error';
    }
  });

  protected search(value: string): void {
    this.store.query.set(value);
  }
}
