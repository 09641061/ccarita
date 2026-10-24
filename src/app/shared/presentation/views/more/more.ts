import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { NavigationItem } from '../../components/shell/navigation-item';

/** The phone's "Más": the destinations that do not fit the bottom bar. */
@Component({
  selector: 'app-more',
  imports: [MatIconModule, MatListModule, RouterLink, TranslatePipe],
  template: `
    <h1>{{ 'shared.nav.more' | translate }}</h1>
    <mat-nav-list>
      @for (item of items(); track item.path) {
        <a mat-list-item [routerLink]="item.path">
          <mat-icon matListItemIcon aria-hidden="true">{{ item.icon }}</mat-icon>
          <span matListItemTitle>{{ item.label | translate }}</span>
        </a>
      }
    </mat-nav-list>
  `,
  styles: `
    h1 {
      margin-bottom: 8px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class More {
  readonly navigation = input.required<readonly NavigationItem[]>();

  protected readonly items = computed(() =>
    this.navigation().filter((item) => item.placement === 'more'),
  );
}
