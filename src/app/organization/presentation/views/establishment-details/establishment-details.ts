import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { FormField, form, maxLength, required } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { TranslatePipe } from '@ngx-translate/core';
import { ApiError } from '../../../../shared/domain/model/api-error';
import { BusyButton } from '../../../../shared/presentation/components/busy-button/busy-button';
import { ErrorMessagePipe } from '../../../../shared/presentation/pipes/error-message.pipe';
import { CurrentEstablishment } from '../../../application/current-establishment.store';
import { CurrentOrganization } from '../../../application/current-organization.store';
import {
  Establishment,
  EstablishmentDetails as Details,
} from '../../../domain/model/establishment';
import { DEFAULT_TIME_ZONE, timeZoneOptions } from './time-zones';

/**
 * The form inside a row of Locales, for the owner (03 §5): one establishment's name, address and time zone (O7).
 * Saving is a PUT, so it needs no idempotency key; an inactive plan disables it (O6). Editing an establishment does
 * not select it.
 */
@Component({
  selector: 'app-establishment-details',
  imports: [
    BusyButton,
    ErrorMessagePipe,
    FormField,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    TranslatePipe,
  ],
  templateUrl: './establishment-details.html',
  styleUrls: ['../section.scss', './establishment-details.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EstablishmentDetails {
  private readonly organization = inject(CurrentOrganization);
  private readonly establishment = inject(CurrentEstablishment);

  readonly place = input.required<Establishment>();
  readonly saved = output();
  readonly cancelled = output();

  protected readonly model = signal<Details>({
    name: '',
    address: '',
    timeZone: DEFAULT_TIME_ZONE,
  });
  protected readonly detailsForm = form(this.model, (path) => {
    required(path.name);
    maxLength(path.name, 120);
    maxLength(path.address, 300);
  });
  protected readonly timeZones = computed(() => timeZoneOptions(this.model().timeZone));
  protected readonly busy = signal(false);
  protected readonly error = signal<ApiError | null>(null);
  protected readonly canChange = computed(() => this.organization.planActive());

  constructor() {
    // Fills once per establishment, not when the list reloads after saving.
    const id = computed(() => this.place().id);
    effect(() => {
      id();
      untracked(() => {
        const place = this.place();
        this.model.set({ name: place.name, address: place.address, timeZone: place.timeZone });
        this.error.set(null);
      });
    });
  }

  protected async save(event?: Event): Promise<void> {
    event?.preventDefault();
    this.detailsForm().markAsTouched();
    if (this.busy() || this.detailsForm().invalid() || !this.model().name.trim()) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      await this.establishment.describe(this.place().id, this.model());
      this.saved.emit();
    } catch (error) {
      this.error.set(ApiError.of(error));
    } finally {
      this.busy.set(false);
    }
  }
}
