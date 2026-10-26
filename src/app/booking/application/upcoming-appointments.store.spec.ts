import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { appointmentResource } from '../../../testing/booking-fixtures';
import { settle } from '../../../testing/settle';
import { CurrentEstablishment } from '../../organization/public-api';
import { API_BASE_URL } from '../../shared/infrastructure/http/api-base-url';
import { apiErrorInterceptor } from '../../shared/infrastructure/http/api-error.interceptor';
import { UpcomingAppointments } from './upcoming-appointments.store';

const API = 'http://api.test';
const NOW = new Date('2026-10-23T15:00:00Z');

describe('UpcomingAppointments', () => {
  let backend: HttpTestingController;
  let store: UpcomingAppointments;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'], now: NOW });
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiErrorInterceptor])),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: API },
        { provide: CurrentEstablishment, useValue: { id: signal('est-1') } },
      ],
    });
    backend = TestBed.inject(HttpTestingController);
    store = TestBed.inject(UpcomingAppointments);
  });

  afterEach(() => {
    backend.verify();
    vi.useRealTimers();
  });

  it('reads nothing until a customer is chosen', async () => {
    await settle();
    backend.expectNone(() => true);
    expect(store.appointments.hasValue()).toBe(false);
  });

  it('W11, W12: reads the next 42 days and keeps the customer’s confirmed appointments not started', async () => {
    store.select('c-1');
    await settle();
    const request = backend.expectOne(
      (r) => r.url === `${API}/api/v1/establishments/est-1/appointments`,
    );
    expect(request.request.params.get('from')).toBe('2026-10-23T15:00:00.000Z');
    expect(request.request.params.get('to')).toBe('2026-12-04T15:00:00.000Z');
    request.flush([
      appointmentResource('started', { start: '2026-10-23T14:30:00Z' }),
      appointmentResource('next', { start: '2026-10-24T15:00:00Z' }),
      appointmentResource('other', { customerId: 'c-2', start: '2026-10-24T16:00:00Z' }),
      appointmentResource('cancelled', { status: 'cancelled', start: '2026-10-25T15:00:00Z' }),
      appointmentResource('later', { start: '2026-11-02T15:00:00Z' }),
    ]);
    await settle();
    expect(store.appointments.value()?.map((a) => a.id)).toEqual(['next', 'later']);
  });
});
