import { Directive, computed, inject, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, UrlTree } from '@angular/router';
import { filter, map } from 'rxjs';

/** The query parameter that opens the settings center over the current screen, with a section id as its value. */
export const SETTINGS_PARAM = 'ajustes';

/** The current address with the settings center open at `section` (`''` for its first section, or the list on phones). */
export function settingsUrl(router: Router, section: string): UrlTree {
  const tree = router.parseUrl(router.url);
  tree.queryParams = { ...tree.queryParams, [SETTINGS_PARAM]: section };
  return tree;
}

/**
 * A link that opens the settings center at a section over whatever screen is open: `<a appSettingsLink="whatsapp">`.
 * Inside the open center it replaces the address, so back still closes the center. Any context may use it; the
 * center itself belongs to `organization`, which the link never imports.
 */
@Directive({
  selector: 'a[appSettingsLink]',
  host: { '[attr.href]': 'href()', '(click)': 'open($event)' },
})
export class SettingsLink {
  private readonly router = inject(Router);

  /** The section id, such as `whatsapp`. */
  readonly appSettingsLink = input.required<string>();

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );
  protected readonly href = computed(() => {
    this.url();
    return this.router.serializeUrl(settingsUrl(this.router, this.appSettingsLink()));
  });

  protected open(event: MouseEvent): void {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey) return;
    event.preventDefault();
    const open = SETTINGS_PARAM in this.router.parseUrl(this.router.url).queryParams;
    void this.router.navigateByUrl(settingsUrl(this.router, this.appSettingsLink()), {
      replaceUrl: open,
    });
  }
}
