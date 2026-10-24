import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  model,
  output,
  signal,
} from '@angular/core';

const LENGTH = 6;

/**
 * The 6-digit sign-in code (I2) as six boxes. One real input underneath keeps it a single field for
 * screen readers, the phone's code autofill (`one-time-code`) and pasting the whole code.
 */
@Component({
  selector: 'app-code-input',
  template: `
    <div class="cells" aria-hidden="true">
      @for (cell of cells(); track $index) {
        <span class="cell" [class.active]="focused() && $index === activeIndex()">{{ cell }}</span>
      }
    </div>
    <input
      [id]="inputId()"
      type="text"
      inputmode="numeric"
      autocomplete="one-time-code"
      [attr.maxlength]="length"
      [value]="value()"
      [attr.aria-invalid]="invalid() || null"
      [attr.aria-describedby]="describedBy() || null"
      (input)="type($event)"
      (focus)="focused.set(true)"
      (blur)="focused.set(false)"
    />
  `,
  styles: `
    :host {
      position: relative;
      display: block;
    }
    .cells {
      display: grid;
      grid-template-columns: repeat(6, minmax(0, 1fr));
      gap: 8px;
    }
    .cell {
      display: grid;
      place-items: center;
      height: 60px;
      border-radius: 10px;
      border: 1px solid var(--mat-sys-outline);
      background: var(--mat-sys-surface);
      font-size: 24px;
      font-weight: 600;
      transition: border-color var(--tk-duration-short) var(--tk-motion-standard);
    }
    .cell.active {
      border: 2px solid var(--tk-ring);
    }
    :host(.invalid) .cell {
      border-color: var(--mat-sys-error);
      background: var(--mat-sys-error-container);
    }
    input {
      position: absolute;
      inset: 0;
      width: 100%;
      opacity: 0;
      font-size: 16px;
      cursor: text;
    }
  `,
  host: { '[class.invalid]': 'invalid()' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CodeInput {
  readonly value = model('');
  readonly invalid = input(false);
  readonly inputId = input.required<string>();
  /** Id of the element that explains an error. */
  readonly describedBy = input<string>();
  /** The sixth digit was entered or pasted. */
  readonly completed = output<string>();

  protected readonly length = LENGTH;
  protected readonly focused = signal(false);
  protected readonly cells = computed(() =>
    Array.from({ length: LENGTH }, (_, i) => this.value().charAt(i)),
  );
  protected readonly activeIndex = computed(() => Math.min(this.value().length, LENGTH - 1));

  protected type(event: Event): void {
    const field = event.target as HTMLInputElement;
    const digits = field.value.replace(/\D/g, '').slice(0, LENGTH);
    field.value = digits;
    this.value.set(digits);
    if (digits.length === LENGTH) this.completed.emit(digits);
  }
}
