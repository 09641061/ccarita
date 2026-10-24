import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { CustomerDirectory } from '../../../../customers/public-api';
import { CurrentOrganization, EstablishmentTeam } from '../../../../organization/public-api';
import { ApiError } from '../../../../shared/domain/model/api-error';
import { LocalDate } from '../../../../shared/domain/model/local-date';
import { newIdempotencyKey } from '../../../../shared/domain/model/idempotency-key';
import { BrandMark } from '../../../../shared/presentation/components/brand-mark/brand-mark';
import { BusyButton } from '../../../../shared/presentation/components/busy-button/busy-button';
import { Skeleton } from '../../../../shared/presentation/components/skeleton/skeleton';
import {
  StateKind,
  StateView,
} from '../../../../shared/presentation/components/state-view/state-view';
import { StatusBadge } from '../../../../shared/presentation/components/status-badge/status-badge';
import { ErrorMessagePipe } from '../../../../shared/presentation/pipes/error-message.pipe';
import { ZonedDatePipe } from '../../../../shared/presentation/pipes/zoned-date.pipe';
import { CalendarStore } from '../../../application/calendar.store';
import { StatusChange } from '../../../domain/model/appointment';
import { CancelSheet, CancelSheetData } from '../cancel-sheet/cancel-sheet';

interface Failure {
  readonly action: StatusChange;
  readonly key: string;
  readonly error: ApiError;
}

/**
 * Detalle de cita: who, what, when and with whom, and the actions B10–B13 allow now. Every role may act on the
 * appointments of the establishments it sees (03 §5). Rescheduling waits for an active plan (O6); finishing,
 * no-shows and cancelling do not.
 */
@Component({
  selector: 'app-appointment-detail',
  imports: [
    BrandMark,
    BusyButton,
    ErrorMessagePipe,
    MatButtonModule,
    MatIconModule,
    RouterLink,
    Skeleton,
    StateView,
    StatusBadge,
    TranslatePipe,
    ZonedDatePipe,
  ],
  templateUrl: './appointment-detail.html',
  styleUrl: './appointment-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppointmentDetail {
  protected readonly store = inject(CalendarStore);
  protected readonly organization = inject(CurrentOrganization);
  private readonly team = inject(EstablishmentTeam);
  private readonly directory = inject(CustomerDirectory);
  private readonly sheet = inject(MatBottomSheet);
  private readonly translate = inject(TranslateService);

  /** From the route `citas/:appointmentId`. */
  readonly appointmentId = input.required<string>();

  protected readonly now = signal(new Date());
  protected readonly appointment = computed(() =>
    this.store.opened.hasValue() ? this.store.opened.value() : null,
  );
  protected readonly customer = computed(() => {
    const appointment = this.appointment();
    return appointment ? this.directory.customers().get(appointment.customerId) : undefined;
  });
  protected readonly customerName = computed(() => {
    const customer = this.customer();
    if (customer === 'deleted')
      return this.translate.instant('booking.appointment.customerDeleted');
    return customer?.displayName ?? this.translate.instant('booking.appointment.customerLoading');
  });
  protected readonly serviceName = computed(() => {
    const id = this.appointment()?.serviceId;
    return (
      (id && this.team.servicesById().get(id)?.name) ??
      this.translate.instant('booking.appointment.service')
    );
  });
  protected readonly memberName = computed(() => {
    const id = this.appointment()?.staffMemberId;
    return (
      (id && this.team.membersById().get(id)?.name) ??
      this.translate.instant('booking.appointment.member')
    );
  });
  protected readonly conflict = computed(() => {
    const appointment = this.appointment();
    return appointment ? (this.store.conflicts().get(appointment.id) ?? null) : null;
  });
  protected readonly isToday = computed(() => {
    const appointment = this.appointment();
    const tz = this.store.timeZone();
    return (
      !!appointment &&
      !!tz &&
      LocalDate.of(appointment.start, tz).equals(LocalDate.of(this.now(), tz))
    );
  });

  protected readonly loadError = computed(() => {
    const error = this.store.opened.error();
    return error ? ApiError.of(error) : null;
  });
  protected readonly errorKind = computed<StateKind>(() => {
    switch (this.loadError()?.code) {
      case 'APPOINTMENT_NOT_FOUND':
        return 'notFound';
      case 'ACCESS_DENIED':
        return 'forbidden';
      case 'NETWORK_ERROR':
        return 'offline';
      default:
        return 'error';
    }
  });

  protected readonly running = signal<StatusChange | null>(null);
  protected readonly failure = signal<Failure | null>(null);

  constructor() {
    effect(() => {
      const id = this.appointmentId();
      untracked(() => {
        this.failure.set(null);
        this.store.open(id);
      });
    });
    const timer = setInterval(() => this.now.set(new Date()), 30_000);
    inject(DestroyRef).onDestroy(() => {
      clearInterval(timer);
      this.store.open(null);
    });
  }

  /** B10, B11. A retry after a lost answer sends the same key, so the change happens once. */
  protected async change(status: StatusChange): Promise<void> {
    const appointment = this.appointment();
    if (!appointment || this.running()) return;
    const prior = this.failure();
    const key = prior?.action === status && prior.error.retryable ? prior.key : newIdempotencyKey();
    this.running.set(status);
    this.failure.set(null);
    try {
      await this.store.changeStatus(appointment, status, key);
    } catch (error) {
      const failure = ApiError.of(error);
      this.failure.set({ action: status, key, error: failure });
      if (!failure.retryable) this.store.opened.reload();
    } finally {
      this.running.set(null);
    }
  }

  protected cancel(): void {
    const appointment = this.appointment();
    const timeZone = this.store.timeZone();
    if (!appointment || !timeZone) return;
    const data: CancelSheetData = {
      appointment,
      customerName: this.customerName(),
      serviceName: this.serviceName(),
      memberName: this.memberName(),
      timeZone,
    };
    this.failure.set(null);
    this.sheet.open(CancelSheet, {
      data,
      ariaLabel: this.translate.instant('booking.cancel.title', { name: data.customerName }),
    });
  }
}
