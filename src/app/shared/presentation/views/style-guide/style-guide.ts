import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  TemplateRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { Avatar } from '../../components/avatar/avatar';
import { BrandMark } from '../../components/brand-mark/brand-mark';
import { BusyButton } from '../../components/busy-button/busy-button';
import { DeliveryStatus } from '../../components/delivery-status/delivery-status';
import { MessageOrigin } from '../../components/message-origin/message-origin';
import { PlanBanner } from '../../components/plan-banner/plan-banner';
import { Skeleton } from '../../components/skeleton/skeleton';
import { StateView } from '../../components/state-view/state-view';
import { StatusBadge } from '../../components/status-badge/status-badge';
import { THEME_ROLES } from '../../theme/theme-roles';
import { RENEWAL_CONTACT } from '../../../application/renewal-contact';

type Scheme = 'system' | 'light' | 'dark';

/**
 * Development-only page (`/dev/ui`) to compare the theme and the shared components with
 * ../ui-reference. Its texts are inline: no user ever sees it.
 */
@Component({
  selector: 'app-style-guide',
  imports: [
    Avatar,
    BrandMark,
    BusyButton,
    DeliveryStatus,
    MatButtonModule,
    MatButtonToggleModule,
    MatChipsModule,
    MatDialogModule,
    MatIconModule,
    MessageOrigin,
    PlanBanner,
    Skeleton,
    StateView,
    StatusBadge,
  ],
  templateUrl: './style-guide.html',
  styleUrl: './style-guide.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StyleGuide {
  private readonly document = inject(DOCUMENT);
  private readonly dialog = inject(MatDialog);
  private readonly dialogTemplate = viewChild.required<TemplateRef<unknown>>('dialog');

  protected readonly roles = THEME_ROLES;
  protected readonly takoduTokens = [
    'status-confirmed',
    'status-confirmed-bg',
    'status-in-progress',
    'status-in-progress-bg',
    'status-completed',
    'status-completed-bg',
    'status-cancelled',
    'status-no-show',
    'warning',
    'warning-bg',
    'member-1',
    'member-2',
    'member-3',
    'member-4',
    'chat-bg',
    'ring',
    'assistant-gradient',
  ];
  protected readonly motionTokens = [
    ['--tk-motion-standard', 'cubic-bezier(0.2, 0, 0, 1)', 'Cambios pequeños, salidas'],
    ['--tk-motion-emphasized', 'cubic-bezier(0.05, 0.7, 0.1, 1)', 'Lo que entra'],
    ['--tk-duration-short', '160ms', 'Hover, botones'],
    ['--tk-duration-medium', '300ms', 'Paneles, hojas'],
  ];
  protected readonly statuses = [
    'confirmed',
    'in_progress',
    'completed',
    'cancelled',
    'no_show',
  ] as const;
  protected readonly origins = [
    'customer',
    'assistant',
    'staff',
    'business_app',
    'system',
    'history',
  ] as const;
  protected readonly deliveries = ['pending', 'sent', 'delivered', 'read', 'failed'] as const;
  protected readonly states = ['empty', 'error', 'offline', 'forbidden', 'notFound'] as const;
  protected readonly planEndedOn = new Date('2026-11-06T17:00:00Z');
  protected readonly renewalContact = inject(RENEWAL_CONTACT);

  protected readonly scheme = signal<Scheme>('system');
  protected readonly busy = signal(false);
  protected readonly showMotion = signal(true);

  protected setScheme(scheme: Scheme): void {
    this.scheme.set(scheme);
    const root = this.document.documentElement.classList;
    root.remove('light', 'dark');
    if (scheme !== 'system') root.add(scheme);
  }

  protected simulateCommand(): void {
    this.busy.set(true);
    setTimeout(() => this.busy.set(false), 1500);
  }

  protected openDialog(): void {
    this.dialog.open(this.dialogTemplate(), { autoFocus: 'dialog' });
  }
}
