import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { firstValueFrom, of } from 'rxjs';
import { CustomerDirectory } from '../../customers/public-api';
import {
  CurrentEstablishment,
  CurrentOrganization,
  EstablishmentTeam,
} from '../../organization/public-api';
import { ApiError } from '../../shared/domain/model/api-error';
import { LocalDate } from '../../shared/domain/model/local-date';
import { Appointment, CancelAppointment, StatusChange } from '../domain/model/appointment';
import { CalendarRange, CalendarView } from '../domain/model/calendar-range';
import { CreateTimeBlock, TimeBlock } from '../domain/model/time-block';
import { AppointmentsApi } from '../infrastructure/appointments.api';
import { TimeBlocksApi } from '../infrastructure/time-blocks.api';

/**
 * The calendar of the selected establishment: one day or one week, everyone or one member, in the establishment's
 * time zone. Appointments and time blocks reload when the establishment or the range changes and after each
 * command; the customers they name are read through `CustomerDirectory`.
 */
@Injectable({ providedIn: 'root' })
export class CalendarStore {
  private readonly appointmentsApi = inject(AppointmentsApi);
  private readonly timeBlocksApi = inject(TimeBlocksApi);
  private readonly establishment = inject(CurrentEstablishment);
  private readonly organization = inject(CurrentOrganization);
  private readonly team = inject(EstablishmentTeam);
  private readonly directory = inject(CustomerDirectory);

  readonly view = signal<CalendarView>('day');
  private readonly chosenDay = signal<LocalDate | null>(null);
  private readonly chosenMember = signal<string | null>(null);

  readonly timeZone = this.establishment.timeZone;
  /** The chosen day, else today in the establishment. */
  readonly day = computed(() => {
    const timeZone = this.timeZone();
    return this.chosenDay() ?? (timeZone ? LocalDate.of(new Date(), timeZone) : null);
  });
  readonly range = computed(() => {
    const day = this.day();
    const timeZone = this.timeZone();
    return day && timeZone ? CalendarRange.of(day, this.view(), timeZone) : null;
  });

  /** The members whose calendars are shown, and the one chosen, if they still work here. */
  readonly members = this.team.bookable;
  readonly memberId = computed(() => {
    const chosen = this.chosenMember();
    return this.members().some((member) => member.id === chosen) ? chosen : null;
  });

  private readonly query = computed(() => {
    const establishmentId = this.establishment.id();
    const range = this.range();
    return establishmentId && range
      ? { establishmentId, from: range.from, to: range.to }
      : undefined;
  });

  readonly appointments = rxResource({
    params: () => this.query(),
    stream: ({ params }) =>
      this.appointmentsApi.listForEstablishment(params.establishmentId, params.from, params.to),
    defaultValue: [],
  });

  readonly timeBlocks = rxResource({
    params: () => this.query(),
    stream: ({ params }) =>
      this.timeBlocksApi.listForEstablishment(params.establishmentId, params.from, params.to),
    defaultValue: [],
  });

  /** The appointment the detail shows; read by id, so a link to another day works too. */
  readonly openedId = signal<string | null>(null);
  readonly opened = rxResource({
    params: () => this.openedId() ?? undefined,
    stream: ({ params }) => (params ? this.appointmentsApi.get(params) : of(null)),
  });

  readonly visibleAppointments = computed(() => {
    const memberId = this.memberId();
    const appointments = this.appointments.value();
    return memberId ? appointments.filter((a) => a.staffMemberId === memberId) : appointments;
  });
  readonly visibleTimeBlocks = computed(() => {
    const memberId = this.memberId();
    const blocks = this.timeBlocks.value();
    return memberId ? blocks.filter((block) => block.appliesTo(memberId)) : blocks;
  });

  /** B15: the first block each booked appointment collides with, by appointment id. */
  readonly conflicts = computed(() => {
    const conflicts = new Map<string, TimeBlock>();
    for (const appointment of this.appointments.value()) {
      const block = this.timeBlocks.value().find((b) => b.conflictsWith(appointment));
      if (block) conflicts.set(appointment.id, block);
    }
    return conflicts;
  });

  /** B15: whether the signed-in member may create or remove anyone's blocks and the establishment's. */
  readonly managesEveryone = computed(() => this.organization.can('manageEveryonesCalendar'));

  constructor() {
    effect(() => {
      const customerIds = this.appointments.value().map((a) => a.customerId);
      const opened = this.opened.hasValue() ? this.opened.value() : null;
      if (opened) customerIds.push(opened.customerId);
      untracked(() => this.directory.want(customerIds));
    });
  }

  showDay(day: LocalDate): void {
    this.chosenDay.set(day);
  }

  showToday(): void {
    this.chosenDay.set(null);
  }

  step(direction: 1 | -1): void {
    const day = this.day();
    if (day) this.chosenDay.set(CalendarRange.step(day, this.view(), direction));
  }

  showView(view: CalendarView): void {
    this.view.set(view);
  }

  /** `null` shows everyone. */
  showMember(memberId: string | null): void {
    this.chosenMember.set(memberId);
  }

  open(appointmentId: string | null): void {
    this.openedId.set(appointmentId);
  }

  canManage(block: TimeBlock): boolean {
    return block.canBeManagedBy(this.organization.memberId(), this.managesEveryone());
  }

  /**
   * B10, B11: starts, completes or marks a no-show.
   * @throws ApiError `INVALID_TRANSITION`, `NO_SHOW_BEFORE_START`, `APPOINTMENT_CONFLICT`, `ACCESS_DENIED`.
   */
  async changeStatus(
    appointment: Appointment,
    status: StatusChange,
    idempotencyKey: string,
  ): Promise<Appointment> {
    return this.applied(
      await firstValueFrom(
        this.appointmentsApi.changeStatus(appointment.id, status, idempotencyKey),
      ),
    );
  }

  /** B12. @throws ApiError `INVALID_TRANSITION`, `APPOINTMENT_CONFLICT`, `ACCESS_DENIED`. */
  async cancel(
    appointment: Appointment,
    command: CancelAppointment,
    idempotencyKey: string,
  ): Promise<Appointment> {
    return this.applied(
      await firstValueFrom(this.appointmentsApi.cancel(appointment.id, command, idempotencyKey)),
    );
  }

  /** B15. @throws ApiError `ACCESS_DENIED`, `MEMBER_NOT_AT_ESTABLISHMENT`, `VALIDATION_ERROR`. */
  async createTimeBlock(command: CreateTimeBlock, idempotencyKey: string): Promise<TimeBlock> {
    const establishmentId = this.establishment.id();
    if (!establishmentId) throw new Error('No establishment is selected');
    const block = await firstValueFrom(
      this.timeBlocksApi.create(establishmentId, command, idempotencyKey),
    );
    this.timeBlocks.reload();
    return block;
  }

  /** B15. @throws ApiError `ACCESS_DENIED`; an already removed block counts as removed. */
  async deleteTimeBlock(block: TimeBlock): Promise<void> {
    try {
      await firstValueFrom(this.timeBlocksApi.delete(block.id));
    } catch (error) {
      if (ApiError.of(error).code !== 'TIME_BLOCK_NOT_FOUND') throw error;
    }
    this.timeBlocks.reload();
  }

  private applied(appointment: Appointment): Appointment {
    if (this.openedId() === appointment.id) this.opened.set(appointment);
    this.appointments.reload();
    return appointment;
  }
}
