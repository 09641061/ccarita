import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  untracked,
} from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { environment } from '../../../../../environments/environment';
import { SessionStore } from '../../../../iam/public-api';
import { PlanBanner } from '../../../../shared/presentation/components/plan-banner/plan-banner';
import { navigationFor } from '../../../../shared/presentation/components/shell/navigation-item';
import { Shell } from '../../../../shared/presentation/components/shell/shell';
import { CurrentEstablishment } from '../../../application/current-establishment.store';
import { CurrentOrganization } from '../../../application/current-organization.store';
import { AccountMenu } from '../../components/account-menu/account-menu';
import { EstablishmentSwitcher } from '../../components/establishment-switcher/establishment-switcher';
import { PlanCard } from '../../components/plan-card/plan-card';

/**
 * The signed-in frame: `Shell` with the destinations of the member's role, the establishment switcher, the plan
 * card and the account menu, and the plan banner on every screen while the plan is inactive (O6). When the session
 * ends (sign-out or a refused refresh) it goes back to sign-in.
 */
@Component({
  selector: 'app-workspace',
  imports: [AccountMenu, EstablishmentSwitcher, PlanBanner, PlanCard, RouterOutlet, Shell],
  templateUrl: './workspace.html',
  styleUrl: './workspace.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Workspace {
  private readonly router = inject(Router);
  protected readonly session = inject(SessionStore);
  protected readonly organization = inject(CurrentOrganization);
  protected readonly establishment = inject(CurrentEstablishment);
  protected readonly renewalContact = environment.renewalContact;

  protected readonly navigation = computed(() =>
    navigationFor(this.organization.role() ?? 'staff'),
  );
  protected readonly canSwitch = computed(
    () => (this.organization.organizations()?.length ?? 0) > 1,
  );
  protected readonly plan = computed(() => {
    const details = this.organization.details;
    return details.hasValue() && details.value().id === this.organization.selected()?.id
      ? details.value().plan
      : null;
  });

  constructor() {
    effect(() => {
      if (this.session.isSignedIn()) return;
      untracked(() => {
        const volver = this.session.signedOut() ? undefined : this.router.url;
        void this.router.navigate(['/ingresar'], { queryParams: { volver } });
      });
    });
  }

  protected async signOut(): Promise<void> {
    await this.session.signOut();
  }
}
