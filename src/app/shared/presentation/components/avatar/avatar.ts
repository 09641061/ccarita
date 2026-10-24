import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * A person's initials on one of the four member colors. Decorative: the name is always shown
 * next to it.
 */
@Component({
  selector: 'app-avatar',
  template: '{{ initials() }}',
  styles: `
    :host {
      display: inline-grid;
      place-items: center;
      flex: none;
      width: var(--avatar-size);
      height: var(--avatar-size);
      border-radius: 999px;
      font-size: calc(var(--avatar-size) * 0.38);
      font-weight: 600;
      line-height: 1;
      color: var(--avatar-fg);
      background: var(--avatar-bg);
      user-select: none;
    }
  `,
  host: {
    'aria-hidden': 'true',
    '[style.--avatar-size.px]': 'size()',
    '[style.--avatar-bg]': "'var(--tk-member-' + color() + ')'",
    '[style.--avatar-fg]': "'var(--tk-member-' + color() + '-fg)'",
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Avatar {
  readonly name = input.required<string>();
  /** Any integer, such as the member's position in the team; it cycles through four colors. */
  readonly colorIndex = input(0);
  readonly size = input(36);

  protected readonly initials = computed(() =>
    this.name()
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => word.charAt(0).toLocaleUpperCase('es-PE'))
      .join(''),
  );
  protected readonly color = computed(() => (Math.abs(Math.trunc(this.colorIndex())) % 4) + 1);
}
