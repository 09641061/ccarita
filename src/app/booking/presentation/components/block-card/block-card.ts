import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe } from '@ngx-translate/core';
import { ZonedDatePipe } from '../../../../shared/presentation/pipes/zoned-date.pipe';
import { BlockEntry } from '../../calendar-entries';

/** A time block in the calendar (B15): who it blocks, when and why, and removal for those who manage it. */
@Component({
  selector: 'app-block-card',
  imports: [MatButtonModule, MatIconModule, TranslatePipe, ZonedDatePipe],
  template: `
    @let e = entry();
    <mat-icon class="lock" aria-hidden="true">block</mat-icon>
    <span class="text">
      <strong>{{ 'booking.block.title' | translate }}</strong>
      <span class="muted">
        · {{ e.memberName ?? ('booking.block.whole' | translate) }}
        @if (compact()) {
          · {{ e.start | zonedDate: timeZone() : 'time' }} –
          {{ e.end | zonedDate: timeZone() : 'time' }}
        }
        @if (e.block.reason) {
          · {{ e.block.reason }}
        }
      </span>
    </span>
    @if (e.manageable) {
      <button
        matIconButton
        type="button"
        [attr.aria-label]="'booking.block.remove' | translate"
        (click)="remove.emit(e)"
      >
        <mat-icon aria-hidden="true">close</mat-icon>
      </button>
    }
  `,
  styles: `
    :host {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      min-width: 0;
      padding: 10px 6px 10px 14px;
      border-radius: 12px;
      color: var(--mat-sys-on-surface-variant);
      background: repeating-linear-gradient(
        135deg,
        var(--mat-sys-surface-container-high) 0 8px,
        var(--mat-sys-surface-container) 8px 16px
      );
    }
    :host(.compact) {
      position: relative;
      flex-direction: column;
      gap: 2px;
      height: 100%;
      padding: 6px 8px;
      overflow: hidden;
      border-radius: 8px;
      font-size: 12px;
    }
    :host(.compact) .text {
      align-self: stretch;
    }
    :host(.compact) button {
      position: absolute;
      top: 6px;
      right: 2px;
      margin: -8px 0;
    }
    .lock {
      flex: none;
      width: 18px;
      height: 18px;
      margin-top: 2px;
      font-size: 18px;
    }
    .text {
      flex: 1;
      min-width: 0;
      align-self: center;
    }
    strong {
      color: var(--mat-sys-on-surface);
      font-weight: 600;
    }
    button {
      flex: none;
      margin: -6px 0;
    }
  `,
  host: { '[class.compact]': 'compact()' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BlockCard {
  readonly entry = input.required<BlockEntry>();
  readonly timeZone = input.required<string>();
  readonly compact = input(false);
  readonly remove = output<BlockEntry>();
}
