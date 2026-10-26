import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { Customer, CustomerDirectory } from '../../../../customers/public-api';
import {
  CurrentEstablishment,
  CurrentOrganization,
  EstablishmentTeam,
  OpeningHoursStore,
} from '../../../../organization/public-api';
import { ApiError } from '../../../../shared/domain/model/api-error';
import { newIdempotencyKey } from '../../../../shared/domain/model/idempotency-key';
import { LocalDate } from '../../../../shared/domain/model/local-date';
import { Avatar } from '../../../../shared/presentation/components/avatar/avatar';
import { BusyButton } from '../../../../shared/presentation/components/busy-button/busy-button';
import { Skeleton } from '../../../../shared/presentation/components/skeleton/skeleton';
import {
  StateKind,
  StateView,
} from '../../../../shared/presentation/components/state-view/state-view';
import { ErrorMessagePipe } from '../../../../shared/presentation/pipes/error-message.pipe';
import { ZonedDatePipe } from '../../../../shared/presentation/pipes/zoned-date.pipe';
import { BookingStore } from '../../../application/booking.store';
import { SlotPicker } from '../../components/slot-picker/slot-picker';
import { CustomerStep } from '../customer-step/customer-step';

export type BookingStep = 'customer' | 'service' | 'time';

const STEPS: readonly BookingStep[] = ['customer', 'service', 'time'];
/** Days the strip shows at once; "Más" moves it on by as many. */
export const STRIP_DAYS = 5;

function errorKindOf(error: ApiError | null): StateKind {
  switch (error?.code) {
    case 'APPOINTMENT_NOT_FOUND':
      return 'notFound';
    case 'ACCESS_DENIED':
      return 'forbidden';
    case 'NETWORK_ERROR':
      return 'offline';
    default:
      return 'error';
  }
}

/**
 * Reservar cita: customer, service, then day, time and member, and one tap to book (B1–B9, B16, B17). With
 * `?reprogramar=<id>` it moves a confirmed appointment instead, keeping its service and customer (B13). Every role
 * books in the establishments it sees (03 §5); an inactive plan blocks both (O6). With `?cliente=<id>`, from a
 * customer's page, that customer is already chosen.
 */
@Component({
  selector: 'app-booking-flow',
  imports: [
    Avatar,
    BusyButton,
    CustomerStep,
    ErrorMessagePipe,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    RouterLink,
    Skeleton,
    SlotPicker,
    StateView,
    TranslatePipe,
    ZonedDatePipe,
  ],
  templateUrl: './booking-flow.html',
  styleUrl: './booking-flow.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BookingFlow {
  protected readonly store = inject(BookingStore);
  protected readonly organization = inject(CurrentOrganization);
  protected readonly establishment = inject(CurrentEstablishment);
  protected readonly team = inject(EstablishmentTeam);
  private readonly openingHours = inject(OpeningHoursStore);
  private readonly router = inject(Router);
  private readonly directory = inject(CustomerDirectory);

  /** From the query `?reprogramar=<appointmentId>`. */
  readonly reprogramar = input<string>();
  /** From the query `?cliente=<customerId>`. */
  readonly cliente = input<string>();
  /** The customer of `?cliente` until the directory knows it; a deleted one is not chosen. */
  private readonly presetCustomerId = signal<string | null>(null);

  protected readonly step = signal<BookingStep>('customer');
  protected readonly stepNumber = computed(() => STEPS.indexOf(this.step()) + 1);
  protected readonly stepCount = STEPS.length;
  protected readonly leaveLink = computed(() => {
    const original = this.reprogramar();
    if (original) return `/agenda/citas/${original}`;
    const customerId = this.cliente();
    return customerId ? `/clientes/${customerId}` : '/agenda';
  });

  protected readonly originalError = computed(() => {
    const error = this.store.rescheduling.error();
    return error ? ApiError.of(error) : null;
  });
  protected readonly originalErrorKind = computed(() => errorKindOf(this.originalError()));
  protected readonly slotsError = computed(() => {
    const error = this.store.slots.error();
    return error ? ApiError.of(error) : null;
  });
  protected readonly slotsErrorKind = computed(() => errorKindOf(this.slotsError()));

  private readonly stripStart = signal<LocalDate | null>(null);
  protected readonly strip = computed(() => {
    const today = this.store.today();
    const start = this.stripStart() ?? this.store.day() ?? today;
    if (!today || !start) return [];
    const first = start.isBefore(today) ? today : start;
    return Array.from({ length: STRIP_DAYS }, (_, i) => first.plusDays(i));
  });
  protected readonly canGoBack = computed(() => {
    const today = this.store.today();
    const first = this.strip()[0];
    return !!today && !!first && today.isBefore(first);
  });

  protected readonly busy = signal(false);
  protected readonly error = signal<ApiError | null>(null);
  private key = newIdempotencyKey();
  private keyInput: string | null = null;
  private readonly command = computed(() =>
    this.store.isRescheduling() ? this.store.rescheduleCommand() : this.store.bookCommand(),
  );

  constructor() {
    effect(() => {
      const appointmentId = this.reprogramar() ?? null;
      untracked(() => {
        this.store.start(appointmentId);
        this.step.set(appointmentId ? 'time' : 'customer');
        this.stripStart.set(null);
        this.error.set(null);
      });
    });
    effect(() => {
      const customerId = this.reprogramar() ? null : (this.cliente() ?? null);
      untracked(() => {
        this.presetCustomerId.set(customerId);
        if (customerId) this.directory.want([customerId]);
      });
    });
    effect(() => {
      const customerId = this.presetCustomerId();
      const known = customerId ? this.directory.customers().get(customerId) : undefined;
      if (!known) return;
      untracked(() => {
        this.presetCustomerId.set(null);
        if (known instanceof Customer && this.step() === 'customer') this.chooseCustomer(known);
      });
    });
  }

  /** O8: a weekday without opening ranges; unknown hours mark nothing. */
  protected isClosed(day: LocalDate): boolean {
    const hours = this.openingHours.hours;
    return hours.hasValue() && !hours.value().isOpenOn(day);
  }

  protected isToday(day: LocalDate): boolean {
    return day.equals(this.store.today());
  }

  protected back(): void {
    const at = STEPS.indexOf(this.step());
    if (this.store.isRescheduling() || at === 0) {
      void this.router.navigateByUrl(this.leaveLink());
    } else {
      this.step.set(STEPS[at - 1]);
    }
  }

  protected goTo(step: BookingStep): void {
    this.step.set(step);
  }

  protected chooseCustomer(customer: Customer): void {
    this.store.chooseCustomer(customer);
    this.step.set(this.store.service() ? 'time' : 'service');
  }

  protected chooseService(serviceId: string): void {
    this.store.chooseService(serviceId);
    this.step.set('time');
  }

  protected chooseDay(day: LocalDate): void {
    this.store.chooseDay(day);
    this.error.set(null);
  }

  protected moveStrip(direction: 1 | -1): void {
    const first = this.strip()[0];
    if (first) this.stripStart.set(first.plusDays(direction * STRIP_DAYS));
  }

  /** B1–B9 or B13. A retry after a lost answer sends the same key, so it books or moves once. */
  protected async confirm(): Promise<void> {
    const command = this.command();
    if (!command || this.busy() || !this.organization.planActive()) return;
    const input = JSON.stringify(command);
    if (this.keyInput !== null && this.keyInput !== input) this.key = newIdempotencyKey();
    this.keyInput = input;
    this.busy.set(true);
    this.error.set(null);
    try {
      const appointment = this.store.isRescheduling()
        ? await this.store.reschedule(this.key)
        : await this.store.book(this.key);
      this.key = newIdempotencyKey();
      this.keyInput = null;
      await this.router.navigate(['/agenda/citas', appointment.id]);
    } catch (error) {
      const failure = ApiError.of(error);
      this.error.set(failure);
      if (!failure.retryable) {
        this.key = newIdempotencyKey();
        this.keyInput = null;
      }
    } finally {
      this.busy.set(false);
    }
  }
}
