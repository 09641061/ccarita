import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

/** Placeholder rows while the first load of a list is pending; later reloads keep the old data. */
@Component({
  selector: 'app-skeleton',
  imports: [TranslatePipe],
  template: `
    <span class="tk-visually-hidden">{{ 'shared.state.loading' | translate }}</span>
    @for (row of rowList(); track row) {
      <div class="row" aria-hidden="true"><span></span><span></span></div>
    }
  `,
  styleUrl: './skeleton.scss',
  host: { role: 'status', 'aria-busy': 'true' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Skeleton {
  readonly rows = input(3);

  protected readonly rowList = computed(() => Array.from({ length: this.rows() }, (_, i) => i));
}
