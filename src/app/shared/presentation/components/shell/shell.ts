import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { filter, map } from 'rxjs';
import { NavigationItem, activeItem } from './navigation-item';

/**
 * The signed-in frame: a navigation drawer from 1024 px, and below that a bottom bar with the same destinations.
 * The session fills the establishment and profile slots of the drawer and, on phones, the top bar slot; the screen
 * goes in the default slot. No unread count: pibble serves no total.
 */
@Component({
  selector: 'app-shell',
  imports: [MatIconModule, MatListModule, RouterLink, TranslatePipe],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Shell {
  private readonly router = inject(Router);

  /** The destinations the current role may see, in order (`navigationFor`). */
  readonly navigation = input.required<readonly NavigationItem[]>();

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );
  /** The destination of the current screen (`activeItem`). */
  protected readonly active = computed(() => activeItem(this.navigation(), this.url())?.path);
}
