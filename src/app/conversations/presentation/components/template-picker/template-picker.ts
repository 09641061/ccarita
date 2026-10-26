import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  linkedSignal,
  output,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { Appointment } from '../../../../booking/public-api';
import { ApiError } from '../../../../shared/domain/model/api-error';
import { BusyButton } from '../../../../shared/presentation/components/busy-button/busy-button';
import { Skeleton } from '../../../../shared/presentation/components/skeleton/skeleton';
import { ErrorMessagePipe } from '../../../../shared/presentation/pipes/error-message.pipe';
import { ZonedDatePipe } from '../../../../shared/presentation/pipes/zoned-date.pipe';
import {
  AppointmentTemplate,
  SendTemplate,
  TemplateChoice,
} from '../../../domain/model/template-choice';

/**
 * The reminder and confirmation of one upcoming appointment (W11, W12), each with Meta's review when it goes as a
 * template (W6). Only sendable choices can be picked; the chat owns the idempotency key and sending.
 */
@Component({
  selector: 'app-template-picker',
  imports: [
    BusyButton,
    ErrorMessagePipe,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatRadioModule,
    MatSelectModule,
    RouterLink,
    Skeleton,
    TranslatePipe,
    ZonedDatePipe,
  ],
  templateUrl: './template-picker.html',
  styleUrl: './template-picker.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TemplatePicker {
  readonly choices = input.required<readonly TemplateChoice[]>();
  /** The customer's upcoming appointments, earliest first; `null` while they load. */
  readonly appointments = input.required<readonly Appointment[] | null>();
  readonly appointmentsError = input<ApiError | null>(null);
  readonly timeZone = input.required<string>();
  readonly memberNames = input.required<ReadonlyMap<string, string>>();
  readonly serviceNames = input.required<ReadonlyMap<string, string>>();
  readonly customerId = input.required<string>();
  readonly busy = input(false);
  readonly error = input<ApiError | null>(null);

  readonly send = output<SendTemplate>();
  readonly reload = output<void>();

  /** The appointment picked, kept while it is still upcoming. */
  protected readonly appointmentId = linkedSignal<readonly Appointment[] | null, string | null>({
    source: this.appointments,
    computation: (appointments, previous) =>
      appointments?.find((a) => a.id === previous?.value)?.id ?? appointments?.[0]?.id ?? null,
  });
  protected readonly appointment = computed(
    () => this.appointments()?.find((a) => a.id === this.appointmentId()) ?? null,
  );

  /** The template picked, kept while it can still be sent. */
  protected readonly template = linkedSignal<readonly TemplateChoice[], AppointmentTemplate | null>(
    {
      source: this.choices,
      computation: (choices, previous) =>
        choices.find((c) => c.sendable && c.template === previous?.value)?.template ??
        choices.find((c) => c.sendable)?.template ??
        null,
    },
  );

  protected submit(): void {
    const template = this.template();
    const appointmentId = this.appointmentId();
    if (template && appointmentId && !this.busy()) this.send.emit({ template, appointmentId });
  }
}
