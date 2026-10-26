import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { FormField, form, maxLength, required } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TranslatePipe } from '@ngx-translate/core';
import { ApiError } from '../../../../shared/domain/model/api-error';
import { BusyButton } from '../../../../shared/presentation/components/busy-button/busy-button';
import { ErrorMessagePipe } from '../../../../shared/presentation/pipes/error-message.pipe';
import { Member } from '../../../domain/model/member';
import { Service } from '../../../domain/model/service';
import { ServiceDetails, priceCentsOf, priceTextOf } from '../../../domain/model/service-details';

interface ServiceFormModel {
  name: string;
  duration: string;
  price: string;
  instructions: string;
}

const EMPTY: ServiceFormModel = { name: '', duration: '', price: '', instructions: '' };

/**
 * A service's name, duration, price in soles, instructions and performers (O14, O15). The performers offered are
 * the members who take appointments at the establishment; a performer no longer among them is dropped, as pibble
 * drops them too. The view sends what `save` emits.
 */
@Component({
  selector: 'app-service-form',
  imports: [
    BusyButton,
    ErrorMessagePipe,
    FormField,
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatInputModule,
    TranslatePipe,
  ],
  templateUrl: './service-form.html',
  styleUrl: './service-form.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServiceForm {
  /** The service being edited; `null` creates one. */
  readonly service = input<Service | null>(null);
  readonly performers = input.required<readonly Member[]>();
  readonly busy = input(false);
  readonly disabled = input(false);
  readonly error = input<ApiError | null>(null);
  readonly save = output<ServiceDetails>();
  readonly closed = output<void>();

  protected readonly model = signal<ServiceFormModel>(EMPTY);
  protected readonly serviceForm = form(this.model, (path) => {
    required(path.name);
    maxLength(path.name, 120);
    maxLength(path.instructions, 1000);
  });
  protected readonly chosen = signal<ReadonlySet<string>>(new Set());
  protected readonly attempted = signal(false);

  protected readonly durationMinutes = computed(() => {
    const value = Number(this.model().duration);
    return Number.isInteger(value) && value >= 1 && value <= 720 ? value : null;
  });
  protected readonly priceCents = computed(() => priceCentsOf(this.model().price));

  constructor() {
    effect(() => {
      const service = this.service();
      untracked(() => {
        const eligible = new Set(this.performers().map((member) => member.id));
        this.model.set(
          service
            ? {
                name: service.name,
                duration: String(service.durationMinutes),
                price: priceTextOf(service.price.cents),
                instructions: service.instructions,
              }
            : EMPTY,
        );
        this.chosen.set(new Set(service?.performerIds.filter((id) => eligible.has(id)) ?? []));
        this.attempted.set(false);
      });
    });
  }

  protected toggle(memberId: string, checked: boolean): void {
    const next = new Set(this.chosen());
    if (checked) next.add(memberId);
    else next.delete(memberId);
    this.chosen.set(next);
  }

  protected submit(event?: Event): void {
    event?.preventDefault();
    this.attempted.set(true);
    this.serviceForm().markAsTouched();
    const durationMinutes = this.durationMinutes();
    const priceCents = this.priceCents();
    const name = this.model().name.trim();
    if (this.busy() || this.serviceForm().invalid() || !name) return;
    if (durationMinutes === null || priceCents === null) return;
    this.save.emit({
      name,
      durationMinutes,
      priceCents,
      instructions: this.model().instructions.trim(),
      performerIds: this.performers()
        .map((member) => member.id)
        .filter((id) => this.chosen().has(id)),
    });
  }
}
