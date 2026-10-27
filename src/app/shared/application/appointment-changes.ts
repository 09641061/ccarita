import { InjectionToken } from '@angular/core';
import { EMPTY, Observable } from 'rxjs';

/** An appointment booking committed a change to, in an establishment the member sees. */
export interface AppointmentChangeNotice {
  readonly appointmentId: string;
  readonly establishmentId: string;
}

/**
 * Live appointment changes, so an open calendar reloads without polling. The inbox stream carries them and
 * `conversations` owns it, which `booking` may not import, so the app provides this from it; without that, none
 * arrive.
 */
export const APPOINTMENT_CHANGES = new InjectionToken<Observable<AppointmentChangeNotice>>(
  'AppointmentChanges',
  { factory: () => EMPTY },
);
