import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { FormField, form, maxLength, required } from '@angular/forms/signals';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { TranslatePipe } from '@ngx-translate/core';
import { ACCOUNT_WORKSPACE, Account } from '../../../../iam/public-api';
import { ApiError } from '../../../../shared/domain/model/api-error';
import { BusyButton } from '../../../../shared/presentation/components/busy-button/busy-button';
import { ErrorMessagePipe } from '../../../../shared/presentation/pipes/error-message.pipe';
import { CurrentEstablishment } from '../../../application/current-establishment.store';
import { CurrentOrganization } from '../../../application/current-organization.store';
import { EstablishmentTeam } from '../../../application/establishment-team.store';

/**
 * Ajustes › Cuenta: `iam`'s account, told the name the organization knows the user by, the selected establishment's
 * time zone and whether there are other organizations; the member's own name in this organization (O9), for any
 * role and plan; for the owner (O2) also the business name, which waits for an active plan (O6).
 */
@Component({
  selector: 'app-account-settings',
  imports: [
    Account,
    BusyButton,
    ErrorMessagePipe,
    FormField,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    TranslatePipe,
  ],
  templateUrl: './account-settings.html',
  styleUrls: ['../section.scss', './account-settings.scss'],
  providers: [
    {
      provide: ACCOUNT_WORKSPACE,
      useFactory: () => {
        const organization = inject(CurrentOrganization);
        const team = inject(EstablishmentTeam);
        return {
          timeZone: inject(CurrentEstablishment).timeZone,
          name: computed(() => team.me()?.name ?? null),
          canSwitchOrganization: computed(() => (organization.organizations()?.length ?? 0) > 1),
        };
      },
    },
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountSettings {
  protected readonly organization = inject(CurrentOrganization);
  private readonly team = inject(EstablishmentTeam);

  protected readonly meModel = signal({ name: '' });
  protected readonly meForm = form(this.meModel, (path) => {
    required(path.name);
    maxLength(path.name, 120);
  });
  protected readonly meBusy = signal(false);
  protected readonly meError = signal<ApiError | null>(null);
  protected readonly meSaved = signal(false);

  protected readonly canChange = computed(() => this.organization.planActive());
  protected readonly model = signal({ name: '' });
  protected readonly nameForm = form(this.model, (path) => {
    required(path.name);
    maxLength(path.name, 120);
  });
  protected readonly busy = signal(false);
  protected readonly error = signal<ApiError | null>(null);
  protected readonly saved = signal(false);

  constructor() {
    // Refills once the membership loads or changes, not while the member types.
    const myName = computed(() => this.team.me()?.name ?? '');
    effect(() => {
      const name = myName();
      untracked(() => {
        if (!this.meBusy()) this.meModel.set({ name });
      });
    });
    // Refills when another organization is selected, not when the memberships reload after renaming.
    const selectedId = computed(() => this.organization.selected()?.id);
    effect(() => {
      selectedId();
      untracked(() => {
        this.model.set({ name: this.organization.selected()?.name ?? '' });
        this.error.set(null);
        this.saved.set(false);
      });
    });
  }

  protected async renameMe(event?: Event): Promise<void> {
    event?.preventDefault();
    this.meForm().markAsTouched();
    const name = this.meModel().name;
    if (this.meBusy() || this.meForm().invalid() || !name.trim()) return;
    this.meBusy.set(true);
    this.meError.set(null);
    this.meSaved.set(false);
    try {
      await this.team.renameMe(name);
      this.meSaved.set(true);
    } catch (error) {
      this.meError.set(ApiError.of(error));
    } finally {
      this.meBusy.set(false);
    }
  }

  protected async rename(event?: Event): Promise<void> {
    event?.preventDefault();
    this.nameForm().markAsTouched();
    const name = this.model().name;
    if (this.busy() || this.nameForm().invalid() || !name.trim()) return;
    this.busy.set(true);
    this.error.set(null);
    this.saved.set(false);
    try {
      await this.organization.rename(name);
      this.saved.set(true);
    } catch (error) {
      this.error.set(ApiError.of(error));
    } finally {
      this.busy.set(false);
    }
  }
}
