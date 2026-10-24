import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe } from '@ngx-translate/core';

/** pibble's delivery statuses; `received` marks an inbound message and shows nothing. */
export type DeliveryStatusKind = 'received' | 'pending' | 'sent' | 'delivered' | 'read' | 'failed';

const ICONS: Record<Exclude<DeliveryStatusKind, 'received'>, string> = {
  pending: 'schedule',
  sent: 'check',
  delivered: 'done_all',
  read: 'done_all',
  failed: 'error',
};

/** An outbound message's delivery: a distinct icon per status, with its name for screen readers. */
@Component({
  selector: 'app-delivery-status',
  imports: [MatIconModule, TranslatePipe],
  template: `
    @if (icon(); as icon) {
      <mat-icon
        role="img"
        [attr.aria-label]="'shared.deliveryStatus.' + status() | translate"
        [attr.title]="'shared.deliveryStatus.' + status() | translate"
        >{{ icon }}</mat-icon
      >
    }
  `,
  styles: `
    :host {
      display: inline-flex;
      color: var(--mat-sys-on-surface-variant);
    }
    :host(.read) {
      color: var(--mat-sys-on-primary-container);
    }
    :host(.failed) {
      color: var(--mat-sys-error);
    }
    mat-icon {
      width: 16px;
      height: 16px;
      font-size: 16px;
    }
  `,
  host: { '[class]': 'status()' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeliveryStatus {
  readonly status = input.required<DeliveryStatusKind>();

  protected readonly icon = computed(() => {
    const status = this.status();
    return status === 'received' ? null : ICONS[status];
  });
}
