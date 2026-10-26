import { BreakpointObserver } from '@angular/cdk/layout';
import { NgComponentOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  Type,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { NavigationEnd, Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { filter, map } from 'rxjs';
import { StateView } from '../../../../shared/presentation/components/state-view/state-view';
import {
  SETTINGS_PARAM,
  settingsUrl,
} from '../../../../shared/presentation/navigation/settings-link';
import { CurrentEstablishment } from '../../../application/current-establishment.store';
import { CurrentOrganization } from '../../../application/current-organization.store';
import { SETTINGS_SCREENS } from '../../settings-screens';
import { SettingsGroup, SettingsSection, settingsSections } from './settings-sections';

const GROUPS: readonly SettingsGroup[] = ['account', 'establishment', 'organization'];

/**
 * The settings center, a window over the current screen like Claude's settings: the sections the role may use on
 * the left, grouped into the account, the selected establishment and the organization, and the chosen one on the
 * right; on phones the list, then the section with a back arrow. The section is `?ajustes=<id>`, so back closes the
 * window and a section can be linked; switching sections replaces the address. A value the role cannot use opens the
 * first section it can.
 */
@Component({
  selector: 'app-settings-center',
  imports: [MatButtonModule, MatIconModule, NgComponentOutlet, StateView, TranslatePipe],
  templateUrl: './settings-center.html',
  styleUrl: './settings-center.scss',
  host: { '[class.wide]': 'wide()' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsCenter {
  private readonly router = inject(Router);
  private readonly ref = inject(MatDialogRef<SettingsCenter>);
  protected readonly organization = inject(CurrentOrganization);
  protected readonly establishment = inject(CurrentEstablishment);
  private readonly all = settingsSections(inject(SETTINGS_SCREENS));

  /** Two columns from 720 px; below, the list and the section take turns. */
  protected readonly wide = toSignal(
    inject(BreakpointObserver)
      .observe('(min-width: 720px)')
      .pipe(map((state) => state.matches)),
    { initialValue: true },
  );

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );
  /** The `?ajustes=` value; `''` asks for the first section, or the list on phones. */
  private readonly requested = computed(
    () =>
      (this.router.parseUrl(this.url()).queryParams[SETTINGS_PARAM] as string | undefined) ?? '',
  );

  protected readonly sections = computed(() =>
    this.all.filter((section) => !section.action || this.organization.can(section.action)),
  );
  protected readonly groups = computed(() =>
    GROUPS.map((group) => ({
      group,
      sections: this.sections().filter((section) => section.group === group),
    })).filter((entry) => entry.sections.length > 0),
  );

  /** The open section; `null` shows the list, only on phones. */
  protected readonly selected = computed<SettingsSection | null>(() => {
    const sections = this.sections();
    const wanted = this.requested();
    const found = sections.find((section) => section.id === wanted);
    if (found) return found;
    return wanted || this.wide() ? (sections[0] ?? null) : null;
  });

  private readonly loaded = new Map<string, Type<unknown>>();
  protected readonly component = signal<Type<unknown> | null>(null);

  constructor() {
    effect(() => {
      const section = this.selected();
      this.component.set(section ? (this.loaded.get(section.id) ?? null) : null);
      if (!section || this.loaded.has(section.id)) return;
      void section.load().then((type) => {
        this.loaded.set(section.id, type);
        if (this.selected()?.id === section.id) this.component.set(type);
      });
    });
  }

  protected open(section: SettingsSection): void {
    void this.router.navigateByUrl(settingsUrl(this.router, section.id), { replaceUrl: true });
  }

  /** Phones: back to the list. */
  protected backToList(): void {
    void this.router.navigateByUrl(settingsUrl(this.router, ''), { replaceUrl: true });
  }

  protected close(): void {
    this.ref.close();
  }
}
