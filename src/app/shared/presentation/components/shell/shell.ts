import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { BrandMark } from '../brand-mark/brand-mark';
import { NavigationItem } from './navigation-item';

/**
 * The signed-in frame: a navigation drawer from 1024 px, and below that a bottom bar with the
 * daily destinations plus "Más". The session fills the establishment, plan and account slots;
 * the screen goes in the default slot. No unread count: pibble serves no total.
 */
@Component({
  selector: 'app-shell',
  imports: [BrandMark, MatIconModule, MatListModule, RouterLink, RouterLinkActive, TranslatePipe],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Shell {
  /** The destinations the current role may see, in order (`navigationFor`). */
  readonly navigation = input.required<readonly NavigationItem[]>();

  protected readonly barItems = computed(() =>
    this.navigation().filter((item) => item.placement === 'bar'),
  );
  protected readonly hasMore = computed(() =>
    this.navigation().some((item) => item.placement === 'more'),
  );
}
