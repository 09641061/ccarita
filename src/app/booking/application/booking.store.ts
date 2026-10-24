import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { Customer, CustomerDirectory } from '../../customers/public-api';
import { CurrentEstablishment, EstablishmentTeam, Member } from '../../organization/public-api';
import { ApiError } from '../../shared/domain/model/api-error';
import { LocalDate } from '../../shared/domain/model/local-date';
import { Appointment, BookAppointment, RescheduleAppointment } from '../domain/model/appointment';
import { Slot } from '../domain/model/slot';
import { AppointmentsApi } from '../infrastructure/appointments.api';
import { ServiceSlotsApi } from '../infrastructure/service-slots.api';
import { CalendarStore } from './calendar.store';

/**
 * Booking a new appointment, or rescheduling one (B13), at the selected establishment: customer, service, day,
 * slot and member. Slots reload with the service, the day and the customer; a member only narrows them, because
 * each slot names who is free (B16). After a booking the calendar shows its day.
 */
@Injectable({ providedIn: 'root' })
export class BookingStore {
  private readonly appointmentsApi = inject(AppointmentsApi);
  private readonly slotsApi = inject(ServiceSlotsApi);
  private readonly establishment = inject(CurrentEstablishment);
  private readonly team = inject(EstablishmentTeam);
  private readonly calendar = inject(CalendarStore);
  private readonly directory = inject(CustomerDirectory);

  readonly timeZone = this.establishment.timeZone;

  private readonly rescheduleId = signal<string | null>(null);
  private readonly chosenCustomer = signal<Customer | null>(null);
  private readonly chosenService = signal<string | null>(null);
  private readonly chosenDay = signal<LocalDate | null>(null);
  private readonly chosenMember = signal<string | null>(null);
  private readonly chosenStart = signal<number | null>(null);

  /** The appointment being rescheduled; its service and customer stay. */
  readonly rescheduling = rxResource({
    params: () => this.rescheduleId() ?? undefined,
    stream: ({ params }) => this.appointmentsApi.get(params),
  });
  readonly isRescheduling = computed(() => this.rescheduleId() !== null);
  readonly original = computed<Appointment | null>(() =>
    this.rescheduling.hasValue() ? this.rescheduling.value() : null,
  );

  /** O14, O15: active services someone here performs. */
  readonly services = computed(() => {
    const bookable = new Set(this.team.bookable().map((member) => member.id));
    return this.team.services
      .value()
      .filter((service) => service.active && service.performerIds.some((id) => bookable.has(id)));
  });
  readonly service = computed(() => {
    const id = this.original()?.serviceId ?? this.chosenService();
    return (id && this.team.servicesById().get(id)) || null;
  });

  readonly customerId = computed(
    () => this.original()?.customerId ?? this.chosenCustomer()?.id ?? null,
  );
  readonly customer = computed(() => {
    const id = this.customerId();
    const known = id ? this.directory.customers().get(id) : undefined;
    return known instanceof Customer ? known : this.chosenCustomer();
  });

  readonly today = computed(() => {
    const timeZone = this.timeZone();
    return timeZone ? LocalDate.of(new Date(), timeZone) : null;
  });
  /** The chosen day, else the rescheduled appointment's if it is still ahead, else today. */
  readonly day = computed(() => {
    const today = this.today();
    const timeZone = this.timeZone();
    const original = this.original();
    const originalDay = original && timeZone ? LocalDate.of(original.start, timeZone) : null;
    return (
      this.chosenDay() ??
      (originalDay && today && !originalDay.isBefore(today) ? originalDay : today)
    );
  });

  readonly slots = rxResource({
    params: () => {
      const service = this.service();
      const day = this.day();
      if (!service || !day || (this.isRescheduling() && !this.original())) return undefined;
      // B6: the customer's other appointments; a rescheduled one would collide with itself.
      const customerId = this.isRescheduling() ? null : this.customerId();
      return { serviceId: service.id, date: day, customerId };
    },
    stream: ({ params }) => this.slotsApi.list(params.serviceId, params.date, params.customerId),
  });

  /** O15, B2: the members here who perform the service. */
  readonly performers = computed<readonly Member[]>(() => {
    const service = this.service();
    return service ? this.team.bookable().filter((m) => service.performerIds.includes(m.id)) : [];
  });
  /** The chosen member; null is anyone (B17), or the current member when rescheduling. */
  readonly memberId = computed(() => {
    const chosen = this.chosenMember();
    return this.performers().some((member) => member.id === chosen) ? chosen : null;
  });
  /** The member's color in the calendar, which follows the order of `EstablishmentTeam.bookable`. */
  colorIndex(memberId: string): number {
    return Math.max(
      0,
      this.team.bookable().findIndex((member) => member.id === memberId),
    );
  }

  private readonly slotMemberId = computed(() => {
    const memberId = this.memberId();
    if (memberId) return memberId;
    const kept = this.original()?.staffMemberId;
    return kept && this.performers().some((member) => member.id === kept) ? kept : null;
  });
  /** The slots someone can take, or the chosen (or kept) member can. */
  readonly visibleSlots = computed<readonly Slot[]>(() => {
    const slots = this.slots.hasValue() ? this.slots.value() : [];
    const memberId = this.slotMemberId();
    return memberId ? slots.filter((slot) => slot.isFree(memberId)) : slots;
  });
  readonly slot = computed(
    () => this.visibleSlots().find((slot) => slot.start.getTime() === this.chosenStart()) ?? null,
  );

  /** When the chosen slot ends; a rescheduled appointment keeps its length (B13). */
  readonly slotEnd = computed(() => {
    const slot = this.slot();
    const original = this.original();
    if (!slot) return null;
    return original
      ? new Date(slot.start.getTime() + original.end.getTime() - original.start.getTime())
      : slot.end;
  });

  readonly bookCommand = computed<BookAppointment | null>(() => {
    const customerId = this.customerId();
    const service = this.service();
    const slot = this.slot();
    return !this.isRescheduling() && customerId && service && slot
      ? { customerId, serviceId: service.id, staffMemberId: this.memberId(), start: slot.start }
      : null;
  });
  readonly rescheduleCommand = computed<RescheduleAppointment | null>(() => {
    const original = this.original();
    const slot = this.slot();
    const memberId = this.memberId();
    return original && slot
      ? {
          start: slot.start,
          staffMemberId: memberId && memberId !== original.staffMemberId ? memberId : null,
        }
      : null;
  });

  constructor() {
    effect(() => {
      const customerId = this.original()?.customerId;
      if (customerId) untracked(() => this.directory.want([customerId]));
    });
  }

  /** Starts over, for a new appointment or for rescheduling `appointmentId`. */
  start(appointmentId: string | null): void {
    this.rescheduleId.set(appointmentId);
    this.chosenCustomer.set(null);
    this.chosenService.set(null);
    this.chosenDay.set(null);
    this.chosenMember.set(null);
    this.chosenStart.set(null);
  }

  chooseCustomer(customer: Customer | null): void {
    this.chosenCustomer.set(customer);
    this.chosenStart.set(null);
  }

  chooseService(serviceId: string | null): void {
    this.chosenService.set(serviceId);
    this.chosenMember.set(null);
    this.chosenStart.set(null);
  }

  chooseDay(day: LocalDate): void {
    this.chosenDay.set(day);
    this.chosenStart.set(null);
  }

  chooseSlot(slot: Slot | null): void {
    this.chosenStart.set(slot?.start.getTime() ?? null);
  }

  /** `null` is anyone, or keeping the current member when rescheduling. */
  chooseMember(memberId: string | null): void {
    this.chosenMember.set(memberId);
  }

  /**
   * B1–B9, B17. Reloads the slots after a refusal, so a taken time disappears.
   * @throws ApiError `SLOT_UNAVAILABLE`, `PLAN_INACTIVE`, `OUTSIDE_OPENING_HOURS`, `TIME_BLOCKED`, ….
   */
  async book(idempotencyKey: string): Promise<Appointment> {
    const command = this.bookCommand();
    if (!command) throw new Error('The booking is not complete');
    return this.done(() => this.appointmentsApi.book(command, idempotencyKey));
  }

  /** B13. @throws ApiError as `book`, plus `INVALID_TRANSITION`, `APPOINTMENT_CONFLICT`. */
  async reschedule(idempotencyKey: string): Promise<Appointment> {
    const original = this.original();
    const command = this.rescheduleCommand();
    if (!original || !command) throw new Error('The rescheduling is not complete');
    return this.done(() => this.appointmentsApi.reschedule(original.id, command, idempotencyKey));
  }

  private async done(send: () => ReturnType<AppointmentsApi['book']>): Promise<Appointment> {
    let appointment: Appointment;
    try {
      appointment = await firstValueFrom(send());
    } catch (error) {
      if (!ApiError.of(error).retryable) this.slots.reload();
      throw error;
    }
    const timeZone = this.timeZone();
    if (timeZone) this.calendar.showDay(LocalDate.of(appointment.start, timeZone));
    this.calendar.appointments.reload();
    return appointment;
  }
}
