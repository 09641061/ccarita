import { Routes } from '@angular/router';

/** `/agenda`: the calendar, with an appointment's detail as its child, and booking beside it. */
export const bookingRoutes: Routes = [
  {
    path: 'reservar',
    loadComponent: () => import('./views/booking-flow/booking-flow').then((m) => m.BookingFlow),
    title: 'Reservar cita · Takodu',
  },
  {
    path: '',
    loadComponent: () => import('./views/calendar/calendar').then((m) => m.Calendar),
    title: 'Calendario · Takodu',
    children: [
      {
        path: 'citas/:appointmentId',
        loadComponent: () =>
          import('./views/appointment-detail/appointment-detail').then((m) => m.AppointmentDetail),
        title: 'Cita · Takodu',
      },
    ],
  },
];
