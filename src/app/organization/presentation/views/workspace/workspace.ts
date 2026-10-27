import {
  ChangeDetectionStrategy,
  Component,
  Injector,
  computed,
  effect,
  inject,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { filter, map } from 'rxjs';
import { PLATFORM_ENTRY, SessionStore } from '../../../../iam/public-api';
import { PlanBanner } from '../../../../shared/presentation/components/plan-banner/plan-banner';
import { navigationFor } from '../../../../shared/presentation/components/shell/navigation-item';
import { Shell } from '../../../../shared/presentation/components/shell/shell';
import { SETTINGS_PARAM } from '../../../../shared/presentation/navigation/settings-link';
import { CurrentEstablishment } from '../../../application/current-establishment.store';
import { CurrentOrganization } from '../../../application/current-organization.store';
import { EstablishmentTeam } from '../../../application/establishment-team.store';
import { EstablishmentSwitcher } from '../../components/establishment-switcher/establishment-switcher';
import { ProfileMenu } from '../../components/profile-menu/profile-menu';
import { SettingsCenter } from '../settings-center/settings-center';
import { RENEWAL_CONTACT } from '../../../../shared/application/renewal-contact';

/**
 * The signed-in frame: `Shell` with the destinations of the member's role, the establishment switcher, the profile
 * menu, and the plan banner on every screen while the plan is inactive (O6). `?ajustes=` on any of its screens opens
 * the settings center over it, and removing it closes the center. When the session ends (sign-out or a refused
 * refresh) it goes back to sign-in.
 */
@Component({
  selector: 'app-workspace',
  imports: [EstablishmentSwitcher, PlanBanner, ProfileMenu, RouterOutlet, Shell],
  templateUrl: './workspace.html',
  styleUrl: './workspace.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Workspace {
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly injector = inject(Injector);
  private readonly translate = inject(TranslateService);
  protected readonly session = inject(SessionStore);
  protected readonly organization = inject(CurrentOrganization);
  protected readonly establishment = inject(CurrentEstablishment);
  protected readonly platform = inject(PLATFORM_ENTRY);
  private readonly team = inject(EstablishmentTeam);
  protected readonly renewalContact = inject(RENEWAL_CONTACT);

  protected readonly navigation = computed(() =>
    navigationFor(this.organization.role() ?? 'staff'),
  );
  protected readonly canSwitch = computed(
    () => (this.organization.organizations()?.length ?? 0) > 1,
  );
  /** The name the organization knows the user by; the account's name or email until the members load. */
  protected readonly name = computed(() => {
    return this.team.me()?.name ?? this.session.user()?.displayName ?? '';
  });
  protected readonly plan = computed(() => {
    const details = this.organization.details;
    if (details.hasValue() && details.value().id === this.organization.selected()?.id)
      return details.value().plan;
    return null;
  });

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );
  /** Whether the address asks for the settings center. */
  private readonly settingsOpen = computed(
    () => SETTINGS_PARAM in this.router.parseUrl(this.url()).queryParams,
  );
  private center: MatDialogRef<SettingsCenter> | null = null;

  constructor() {
    effect(() => {
      if (this.session.isSignedIn()) return;
      untracked(() => {
        const volver = this.session.signedOut() ? undefined : this.router.url;
        void this.router.navigate(['/ingresar'], { queryParams: { volver } });
      });
    });
    effect(() => {
      const open = this.settingsOpen();
      untracked(() => (open ? this.openCenter() : this.center?.close()));
    });
  }

  protected async signOut(): Promise<void> {
    await this.session.signOut();
  }

  private openCenter(): void {
    if (this.center) return;
    this.center = this.dialog.open(SettingsCenter, {
      injector: this.injector,
      panelClass: 'tk-settings-center',
      maxWidth: 'none',
      // The address opens and closes it; going back closes it through the address, not the dialog's own handling.
      closeOnNavigation: false,
      autoFocus: 'first-heading',
      restoreFocus: true,
      ariaLabel: this.translate.instant('organization.settingsCenter.title'),
    });
    this.center.afterClosed().subscribe(() => {
      this.center = null;
      // Closed with Esc, the backdrop or the close button: drop the parameter, staying on the screen below.
      if (!this.settingsOpen()) return;
      const tree = this.router.parseUrl(this.router.url);
      tree.queryParams = Object.fromEntries(
        Object.entries(tree.queryParams).filter(([name]) => name !== SETTINGS_PARAM),
      );
      void this.router.navigateByUrl(tree, { replaceUrl: true });
    });
  }
}
