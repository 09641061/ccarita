# File templates

Shapes for each layer, using `booking` and pibble's real contract. Copy the shape, not the business content.

## Domain: `booking/domain/model/appointment.ts`

```ts
import { Money } from '../../../shared/domain/model/money';

export type AppointmentStatus = 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';

/** One customer receiving one service from one member (03 §4.4). */
export class Appointment {
  constructor(
    readonly id: string,
    readonly establishmentId: string,
    readonly customerId: string,
    readonly serviceId: string,
    readonly staffMemberId: string,
    readonly start: Date,
    readonly end: Date,
    readonly price: Money,
    readonly status: AppointmentStatus,
    readonly source: 'staff' | 'assistant',
  ) {}

  /** B10: completed, cancelled and no-show are final. */
  get isFinal(): boolean {
    return this.status === 'completed' || this.status === 'cancelled' || this.status === 'no_show';
  }

  /** B11: no-show only after the start time. */
  canMarkNoShow(now: Date): boolean {
    return this.status === 'confirmed' && now >= this.start;
  }

  /** B13: only confirmed appointments can be rescheduled. */
  get canReschedule(): boolean {
    return this.status === 'confirmed';
  }
}
```

Domain commands are plain readonly types next to the entity: `export interface BookAppointment { readonly customerId: string; readonly serviceId: string; readonly staffMemberId?: string; readonly start: Date }`.

## Infrastructure: assembler `booking/infrastructure/appointment.assembler.ts`

```ts
import type {
  Appointment as AppointmentResource,
  BookAppointmentRequest,
} from '../../shared/infrastructure/api/pibble.schema';
import { Money } from '../../shared/domain/model/money';
import { Appointment, BookAppointment } from '../domain/model/appointment';
import { required } from '../../shared/infrastructure/api/required';

export function toAppointment(resource: AppointmentResource): Appointment {
  return new Appointment(
    required(resource.id, 'Appointment.id'),
    required(resource.establishmentId, 'Appointment.establishmentId'),
    required(resource.customerId, 'Appointment.customerId'),
    required(resource.serviceId, 'Appointment.serviceId'),
    required(resource.staffMemberId, 'Appointment.staffMemberId'),
    new Date(required(resource.start, 'Appointment.start')),
    new Date(required(resource.end, 'Appointment.end')),
    new Money(required(resource.priceCents, 'Appointment.priceCents'), resource.currency ?? 'PEN'),
    required(resource.status, 'Appointment.status'),
    required(resource.source, 'Appointment.source'),
  );
}

export function toBookAppointmentRequest(command: BookAppointment): BookAppointmentRequest {
  return { ...command, start: command.start.toISOString() };
}
```

## Infrastructure: endpoint `booking/infrastructure/appointments.api.ts`

```ts
import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import type { Appointment as AppointmentResource } from '../../shared/infrastructure/api/pibble.schema';
import { API_BASE_URL } from '../../shared/infrastructure/http/api-base-url';
import { idempotent } from '../../shared/infrastructure/http/idempotency';
import { Appointment, BookAppointment } from '../domain/model/appointment';
import { toAppointment, toBookAppointmentRequest } from './appointment.assembler';

/** `/api/v1/appointments` and the establishment calendar of pibble. */
@Injectable({ providedIn: 'root' })
export class AppointmentsApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  listForEstablishment(establishmentId: string, from: Date, to: Date): Observable<Appointment[]> {
    return this.http
      .get<AppointmentResource[]>(
        `${this.baseUrl}/api/v1/establishments/${establishmentId}/appointments`,
        {
          params: { from: from.toISOString(), to: to.toISOString() },
        },
      )
      .pipe(map((resources) => resources.map(toAppointment)));
  }

  book(command: BookAppointment, idempotencyKey: string): Observable<Appointment> {
    return this.http
      .post<AppointmentResource>(
        `${this.baseUrl}/api/v1/appointments`,
        toBookAppointmentRequest(command),
        {
          context: idempotent(idempotencyKey),
        },
      )
      .pipe(map(toAppointment));
  }
}
```

## Application: store `booking/application/calendar.store.ts`

```ts
import { Injectable, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { CurrentEstablishment } from '../../organization/public-api';
import { AppointmentsApi } from '../infrastructure/appointments.api';
import { BookAppointment } from '../domain/model/appointment';

@Injectable({ providedIn: 'root' })
export class CalendarStore {
  private readonly api = inject(AppointmentsApi);
  private readonly establishment = inject(CurrentEstablishment);

  readonly day = signal(startOfToday());

  /** Reloads when the establishment or the day changes. */
  readonly appointments = rxResource({
    params: () => ({ establishmentId: this.establishment.id(), day: this.day() }),
    stream: ({ params }) =>
      this.api.listForEstablishment(params.establishmentId, params.day, nextDay(params.day)),
    defaultValue: [],
  });

  readonly upcoming = computed(() => this.appointments.value().filter((a) => !a.isFinal));

  /** @throws ApiError with pibble's code (SLOT_UNAVAILABLE, PLAN_INACTIVE, …) */
  async book(command: BookAppointment, idempotencyKey: string): Promise<void> {
    await firstValueFrom(this.api.book(command, idempotencyKey));
    this.appointments.reload();
  }
}
```

`startOfToday` and `nextDay` compute in the establishment's time zone (pure helpers in the domain).

## Presentation: view `booking/presentation/views/calendar/calendar.ts`

```ts
@Component({
  selector: 'app-calendar',
  imports: [AppointmentCard, ErrorMessagePipe, MatProgressBarModule, TranslatePipe],
  templateUrl: './calendar.html',
  styleUrl: './calendar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Calendar {
  protected readonly store = inject(CalendarStore);
}
```

```html
@if (store.appointments.isLoading()) {
<mat-progress-bar mode="indeterminate" />
} @if (store.appointments.error(); as error) {
<p role="alert">{{ error | errorMessage }}</p>
} @else { @for (appointment of store.appointments.value(); track appointment.id) {
<app-appointment-card [appointment]="appointment" />
} @empty {
<p>{{ 'booking.calendar.empty' | translate }}</p>
} }
```

## Routes `booking/presentation/booking.routes.ts`

```ts
export const bookingRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./views/calendar/calendar').then((m) => m.Calendar),
    title: 'Agenda',
  },
];
```

Registered in `app.routes.ts` as `{ path: 'agenda', loadChildren: () => import('./booking/presentation/booking.routes').then((m) => m.bookingRoutes) }` under `Layout`.

## `booking/public-api.ts`

```ts
export { Appointment } from './domain/model/appointment';
export { CalendarStore } from './application/calendar.store';
export { BookAppointmentDialog } from './presentation/components/book-appointment-dialog/book-appointment-dialog';
```

## Tests

- Domain: `appointment.spec.ts`, plain Vitest, one test per rule (`canMarkNoShow` before and after start).
- Endpoint and store: `TestBed` with `provideHttpClient()`, `provideHttpClientTesting()` and `API_BASE_URL`; flush pibble-shaped JSON and assert the request (method, URL, `Idempotency-Key`) and the domain result.
- View: `TestBed` with the store replaced by a stub of signals; assert loading, empty, error and data states in the DOM.
