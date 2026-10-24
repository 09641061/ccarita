import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe } from '@ngx-translate/core';
import { BrandMark } from '../brand-mark/brand-mark';

/** pibble's message origins; conversations' `MessageOrigin` is the same union. */
export type MessageOriginKind =
  'customer' | 'assistant' | 'staff' | 'business_app' | 'system' | 'history';

const ICONS: Record<Exclude<MessageOriginKind, 'assistant'>, string> = {
  customer: 'person',
  staff: 'account_circle',
  business_app: 'smartphone',
  system: 'schedule_send',
  history: 'download',
};

/** Who wrote a message: the assistant signs with the mark as "Tako"; a team member by name. */
@Component({
  selector: 'app-message-origin',
  imports: [BrandMark, MatIconModule, TranslatePipe],
  template: `
    @if (origin() === 'assistant') {
      <app-brand-mark [size]="16" />
    } @else {
      <mat-icon aria-hidden="true">{{ icon() }}</mat-icon>
    }
    <span>{{ memberName() || ('shared.messageOrigin.' + origin() | translate) }}</span>
  `,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      font-weight: 500;
      color: var(--mat-sys-on-surface-variant);
    }
    mat-icon {
      width: 16px;
      height: 16px;
      font-size: 16px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MessageOrigin {
  readonly origin = input.required<MessageOriginKind>();
  /** The team member who sent a `staff` message, from the member list. */
  readonly memberName = input<string>();

  protected readonly icon = computed(() => {
    const origin = this.origin();
    return origin === 'assistant' ? '' : ICONS[origin];
  });
}
