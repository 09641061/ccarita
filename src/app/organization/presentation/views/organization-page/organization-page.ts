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
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { environment } from '../../../../../environments/environment';
import { ApiError } from '../../../../shared/domain/model/api-error';
import { BusyButton } from '../../../../shared/presentation/components/busy-button/busy-button';
import { StateView } from '../../../../shared/presentation/components/state-view/state-view';
import { ErrorMessagePipe } from '../../../../shared/presentation/pipes/error-message.pipe';
import { ZonedDatePipe } from '../../../../shared/presentation/pipes/zoned-date.pipe';
import { CurrentEstablishment } from '../../../application/current-establishment.store';
import { CurrentOrganization } from '../../../application/current-organization.store';
import { Establishment } from '../../../domain/model/establishment';
import { ArchiveEstablishmentSheet } from '../archive-establishment-sheet/archive-establishment-sheet';
import { OpenEstablishmentSheet } from '../open-establishment-sheet/open-establishment-sheet';

const LIMA = 'America/Lima';

/**
 * Organización (`/organizacion`), for the owner (03 §5): the business name (O2), the plan and how to renew it (O5),
 * and its establishments, opening (O4) and archiving them. Renaming and opening wait for an active plan; archiving
 * does not (O6). pibble has no self-service payment, so renewing is a message to the Takodu team.
 */
@Component({
  selector: 'app-organization-page',
  imports: [
    BusyButton,
    ErrorMessagePipe,
    FormField,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    StateView,
    TranslatePipe,
    ZonedDatePipe,
  ],
  templateUrl: './organization-page.html',
  styleUrls: ['../settings/section.scss', './organization-page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrganizationPage {
  private readonly sheet = inject(MatBottomSheet);
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);
  protected readonly organization = inject(CurrentOrganization);
  protected readonly establishment = inject(CurrentEstablishment);
  protected readonly renewalContact = environment.renewalContact;

  protected readonly timeZone = computed(() => this.establishment.timeZone() ?? LIMA);
  protected readonly plan = computed(() => {
    const details = this.organization.details;
    return details.hasValue() && details.value().id === this.organization.selected()?.id
      ? details.value().plan
      : null;
  });
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

  protected open(): void {
    this.sheet.open(OpenEstablishmentSheet, {
      ariaLabel: this.translate.instant('organization.settings.openSheet.title'),
    });
  }

  /** Its name, address and time zone are edited in Ajustes › Datos, for the selected establishment. */
  protected edit(target: Establishment): void {
    this.establishment.select(target.id);
    void this.router.navigate(['/ajustes/datos']);
  }

  protected archive(target: Establishment): void {
    this.sheet.open(ArchiveEstablishmentSheet, {
      data: target,
      ariaLabel: this.translate.instant('organization.settings.archiveSheet.title', {
        name: target.name,
      }),
    });
  }
}
