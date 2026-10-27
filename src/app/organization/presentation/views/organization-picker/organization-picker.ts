import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { PLATFORM_ENTRY, SessionStore } from '../../../../iam/public-api';
import { ApiError } from '../../../../shared/domain/model/api-error';
import { StateView } from '../../../../shared/presentation/components/state-view/state-view';
import { safeReturnUrl } from '../../../../shared/presentation/navigation/return-url';
import { CurrentOrganization } from '../../../application/current-organization.store';
import { Wordmark } from '../../../../shared/presentation/components/wordmark/wordmark';

/**
 * Mapa por rol, "Elegir organización (si hay varias)": with one organization it is selected without asking; with
 * none it explains how to get one. The Takodu team also finds its area here, since an operator may own no business.
 */
@Component({
  selector: 'app-organization-picker',
  imports: [
    Wordmark,
    MatButtonModule,
    MatIconModule,
    MatListModule,
    MatProgressBarModule,
    RouterLink,
    StateView,
    TranslatePipe,
  ],
  templateUrl: './organization-picker.html',
  styleUrl: './organization-picker.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrganizationPicker {
  private readonly router = inject(Router);
  protected readonly session = inject(SessionStore);
  protected readonly store = inject(CurrentOrganization);
  protected readonly platform = inject(PLATFORM_ENTRY);

  /** Where to go once an organization is selected, from `?volver=`. */
  readonly volver = input<string>();

  protected readonly loading = signal(true);
  protected readonly error = signal<ApiError | null>(null);

  constructor() {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const organizations = await this.store.load();
      if (organizations.length === 1 && this.store.selected()) await this.continue();
    } catch (error) {
      this.error.set(ApiError.of(error));
    } finally {
      this.loading.set(false);
    }
  }

  protected async choose(organizationId: string): Promise<void> {
    this.store.select(organizationId);
    await this.continue();
  }

  protected async signOut(): Promise<void> {
    await this.session.signOut();
    await this.router.navigateByUrl('/ingresar');
  }

  private async continue(): Promise<void> {
    await this.router.navigateByUrl(safeReturnUrl(this.volver(), '/agenda'));
  }
}
