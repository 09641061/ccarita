import { Injectable, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { defer, map } from 'rxjs';
import { CurrentEstablishment } from '../../organization/public-api';
import { AppointmentsApi } from '../infrastructure/appointments.api';

/** pibble lists an establishment's calendar for at most 42 days at a time. */
export const UPCOMING_DAYS = 42;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * One customer's upcoming appointments at the selected establishment, for the reminders and confirmations the inbox
 * sends (W11, W12). pibble has no per-customer read for members, so this reads the next 42 days of the calendar and
 * keeps the customer's confirmed appointments that have not started, earliest first.
 */
@Injectable({ providedIn: 'root' })
export class UpcomingAppointments {
  private readonly api = inject(AppointmentsApi);
  private readonly establishment = inject(CurrentEstablishment);

  readonly customerId = signal<string | null>(null);

  readonly appointments = rxResource({
    params: () => {
      const establishmentId = this.establishment.id();
      const customerId = this.customerId();
      return establishmentId && customerId ? { establishmentId, customerId } : undefined;
    },
    stream: ({ params }) =>
      defer(() => {
        const now = new Date();
        const to = new Date(now.getTime() + UPCOMING_DAYS * DAY_MS);
        return this.api
          .listForEstablishment(params.establishmentId, now, to)
          .pipe(
            map((appointments) =>
              appointments.filter((a) => a.customerId === params.customerId && a.isUpcoming(now)),
            ),
          );
      }),
  });

  /** Follows another customer; `null` stops reading. */
  select(customerId: string | null): void {
    this.customerId.set(customerId);
  }

  reload(): void {
    this.appointments.reload();
  }
}
