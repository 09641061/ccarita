import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** The Takodu mark (764 × 706). It marks only the assistant and is never recolored. */
const ASPECT = 706 / 764;

/**
 * The assistant's mark: its navigation item, its message signature and the appointments it booked.
 * Decorative unless `label` is given.
 */
@Component({
  selector: 'app-brand-mark',
  template: `<img
    src="brand/takodu.svg"
    [alt]="label() ?? ''"
    [attr.aria-hidden]="label() ? null : 'true'"
    [width]="size()"
    [height]="height()"
  />`,
  styles: `
    :host {
      display: inline-flex;
      flex: none;
    }
    img {
      display: block;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BrandMark {
  /** Width in pixels; the height follows the mark's proportions. */
  readonly size = input(16);
  readonly label = input<string>();

  protected readonly height = computed(() => Math.round(this.size() * ASPECT));
}
