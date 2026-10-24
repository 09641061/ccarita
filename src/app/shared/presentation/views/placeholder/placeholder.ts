import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

/** Stands in for a destination whose context is not built yet; each step replaces one route. */
@Component({
  selector: 'app-placeholder',
  imports: [TranslatePipe],
  template: `
    <h1>{{ label() | translate }}</h1>
    <p class="tk-muted">{{ 'shared.nav.comingSoon' | translate }}</p>
  `,
  styles: `
    h1 {
      margin-bottom: 8px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Placeholder {
  /** Translation key of the destination's name, from the route's data. */
  readonly label = input.required<string>();
}
