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
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { TranslatePipe } from '@ngx-translate/core';
import { ApiError } from '../../../../shared/domain/model/api-error';
import { BusyButton } from '../../../../shared/presentation/components/busy-button/busy-button';
import { StateView } from '../../../../shared/presentation/components/state-view/state-view';
import { ErrorMessagePipe } from '../../../../shared/presentation/pipes/error-message.pipe';
import { CurrentEstablishment } from '../../../application/current-establishment.store';
import { CurrentOrganization } from '../../../application/current-organization.store';
import { EstablishmentDetails as Details } from '../../../domain/model/establishment';
import { DEFAULT_TIME_ZONE, timeZoneOptions } from './time-zones';
import { SettingsLink } from '../../../../shared/presentation/navigation/settings-link';

const EMPTY: Details = { name: '', address: '', timeZone: DEFAULT_TIME_ZONE };

/**
 * Ajustes › Datos, for the owner (03 §5): the selected establishment's name, address and time zone (O7). Opening
 * and archiving establishments live in Organización. Saving is a PUT, so it needs no idempotency key; an inactive
 * plan disables it (O6).
 */
@Component({
  selector: 'app-establishment-details',
  imports: [
    BusyButton,
    ErrorMessagePipe,
    FormField,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    SettingsLink,
    StateView,
    TranslatePipe,
  ],
  templateUrl: './establishment-details.html',
  styleUrl: '../section.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EstablishmentDetails {
  protected readonly organization = inject(CurrentOrganization);
  protected readonly establishment = inject(CurrentEstablishment);

  protected readonly model = signal<Details>(EMPTY);
  protected readonly detailsForm = form(this.model, (path) => {
    required(path.name);
    maxLength(path.name, 120);
    maxLength(path.address, 300);
  });
  protected readonly timeZones = computed(() => timeZoneOptions(this.model().timeZone));
  protected readonly busy = signal(false);
  protected readonly error = signal<ApiError | null>(null);
  protected readonly saved = signal(false);
  protected readonly canChange = computed(() => this.organization.planActive());

  constructor() {
    // Refills when another establishment is selected, not when the list reloads after saving.
    effect(() => {
      this.establishment.id();
      untracked(() => {
        const selected = this.establishment.selected();
        this.model.set(
          selected
            ? { name: selected.name, address: selected.address, timeZone: selected.timeZone }
            : EMPTY,
        );
        this.error.set(null);
        this.saved.set(false);
      });
    });
  }

  protected async save(event?: Event): Promise<void> {
    event?.preventDefault();
    this.detailsForm().markAsTouched();
    const id = this.establishment.id();
    if (!id || this.busy() || this.detailsForm().invalid() || !this.model().name.trim()) return;
    this.busy.set(true);
    this.error.set(null);
    this.saved.set(false);
    try {
      await this.establishment.describe(id, this.model());
      this.saved.set(true);
    } catch (error) {
      this.error.set(ApiError.of(error));
    } finally {
      this.busy.set(false);
    }
  }
}
