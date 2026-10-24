import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatButtonAppearance, MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

/**
 * A command button that blocks a second press while pibble answers (Estados del sistema: "evita
 * doble toque"). While `busy`, it is disabled, announces `aria-busy` and shows progress next to
 * the label, which the screen sets to the action in progress ("Reservando…").
 */
@Component({
  selector: 'app-busy-button',
  imports: [MatButtonModule, MatProgressSpinnerModule],
  template: `
    <button
      [matButton]="appearance()"
      [type]="type()"
      [disabled]="busy() || disabled()"
      [attr.aria-busy]="busy() || null"
      (click)="pressed.emit()"
    >
      @if (busy()) {
        <mat-progress-spinner mode="indeterminate" [diameter]="18" aria-hidden="true" />
      }
      <ng-content />
    </button>
  `,
  styles: `
    :host {
      display: inline-flex;
    }
    mat-progress-spinner {
      display: inline-block;
      margin-right: 8px;
      vertical-align: middle;
      --mat-progress-spinner-active-indicator-color: currentColor;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BusyButton {
  readonly busy = input(false);
  readonly disabled = input(false);
  readonly appearance = input<MatButtonAppearance>('filled');
  readonly type = input<'button' | 'submit'>('button');
  /** Emitted only when the button can act; a disabled button emits nothing. */
  readonly pressed = output<void>();
}
