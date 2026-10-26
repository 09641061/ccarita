import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { BrandMark } from '../brand-mark/brand-mark';
import { filter, map } from 'rxjs';
import { NavigationItem, activeItem } from './navigation-item';

/**
 * The signed-in frame: a navigation drawer from 1024 px, and below that a bottom bar with the
 * daily destinations plus "Más". The session fills the establishment, plan and account slots of
 * the drawer and, on phones, the top bar slot; the screen goes in the default slot. No unread count: pibble serves no total.
 */
@Component({
  selector: 'app-shell',
  imports: [BrandMark, MatIconModule, MatListModule, RouterLink, RouterLinkActive, TranslatePipe],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Shell {
  private readonly router = inject(Router);

  /** The destinations the current role may see, in order (`navigationFor`). */
  readonly navigation = input.required<readonly NavigationItem[]>();

  protected readonly barItems = computed(() =>
    this.navigation().filter((item) => item.placement === 'bar'),
  );
  protected readonly hasMore = computed(() =>
    this.navigation().some((item) => item.placement === 'more'),
  );

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );
  /** The destination of the current screen, by longest path (`activeItem`). */
  protected readonly active = computed(() => activeItem(this.navigation(), this.url())?.path);
}
