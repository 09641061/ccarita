import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { appointmentResource } from '../../../testing/booking-fixtures';
import { ApiError } from '../../shared/domain/model/api-error';
import { API_BASE_URL } from '../../shared/infrastructure/http/api-base-url';
import { apiErrorInterceptor } from '../../shared/infrastructure/http/api-error.interceptor';
import { idempotencyInterceptor } from '../../shared/infrastructure/http/idempotency';
import { AppointmentsApi } from './appointments.api';

const API = 'http://api.test';

describe('AppointmentsApi', () => {
  let backend: HttpTestingController;
  let api: AppointmentsApi;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([idempotencyInterceptor, apiErrorInterceptor])),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: API },
      ],
    });
    backend = TestBed.inject(HttpTestingController);
    api = TestBed.inject(AppointmentsApi);
  });

  afterEach(() => backend.verify());

  it('lists the calendar of a range', async () => {
    const result = firstValueFrom(
      api.listForEstablishment(
        'est-1',
        new Date('2026-10-23T05:00:00Z'),
        new Date('2026-10-24T05:00:00Z'),
      ),
    );
    const request = backend.expectOne(
      (r) => r.url === `${API}/api/v1/establishments/est-1/appointments`,
    );
    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('from')).toBe('2026-10-23T05:00:00.000Z');
    expect(request.request.params.get('to')).toBe('2026-10-24T05:00:00.000Z');
    request.flush([appointmentResource('a-1', { source: 'assistant' })]);

    const [appointment] = await result;
    expect(appointment.start.toISOString()).toBe('2026-10-23T17:00:00.000Z');
    expect(appointment.price.format()).toBe('S/ 35.00');
    expect(appointment.source).toBe('assistant');
    expect(appointment.cancelReason).toBeNull();
  });

  it('changes the status with the idempotency key', async () => {
    const result = firstValueFrom(api.changeStatus('a-1', 'in_progress', 'key-1'));
    const request = backend.expectOne(`${API}/api/v1/appointments/a-1/status-changes`);
    expect(request.request.method).toBe('POST');
    expect(request.request.headers.get('Idempotency-Key')).toBe('key-1');
    expect(request.request.body).toEqual({ status: 'in_progress' });
    request.flush(appointmentResource('a-1', { status: 'in_progress' }));

    expect((await result).status).toBe('in_progress');
  });

  it('cancels with a trimmed reason and who asked', async () => {
    const result = firstValueFrom(
      api.cancel('a-1', { reason: '  Se enfermó ', cancelledBy: 'customer' }, 'key-2'),
    );
    const request = backend.expectOne(`${API}/api/v1/appointments/a-1/cancellations`);
    expect(request.request.headers.get('Idempotency-Key')).toBe('key-2');
    expect(request.request.body).toEqual({ reason: 'Se enfermó', cancelledBy: 'customer' });
    request.flush(
      appointmentResource('a-1', {
        status: 'cancelled',
        cancelReason: 'Se enfermó',
        cancelledBy: 'customer',
      }),
    );

    const cancelled = await result;
    expect([cancelled.status, cancelled.cancelReason, cancelled.cancelledBy]).toEqual([
      'cancelled',
      'Se enfermó',
      'customer',
    ]);
  });

  it('surfaces pibble codes', async () => {
    const result = firstValueFrom(api.changeStatus('a-1', 'no_show', 'key-3'));
    backend
      .expectOne(`${API}/api/v1/appointments/a-1/status-changes`)
      .flush(
        { code: 'NO_SHOW_BEFORE_START', message: 'x' },
        { status: 422, statusText: 'Unprocessable' },
      );

    await expect(result).rejects.toMatchObject({ code: 'NO_SHOW_BEFORE_START' });
    await result.catch((error) => expect(error).toBeInstanceOf(ApiError));
  });

  it('reads one appointment', async () => {
    const result = firstValueFrom(api.get('a-1'));
    backend.expectOne(`${API}/api/v1/appointments/a-1`).flush(appointmentResource('a-1'));
    expect((await result).id).toBe('a-1');
  });

  it('books with a member and the idempotency key', async () => {
    const start = new Date('2026-10-23T16:45:00Z');
    const result = firstValueFrom(
      api.book({ customerId: 'c-1', serviceId: 's-1', staffMemberId: 'm-2', start }, 'key-4'),
    );
    const request = backend.expectOne(`${API}/api/v1/appointments`);
    expect(request.request.method).toBe('POST');
    expect(request.request.headers.get('Idempotency-Key')).toBe('key-4');
    expect(request.request.body).toEqual({
      customerId: 'c-1',
      serviceId: 's-1',
      staffMemberId: 'm-2',
      start: '2026-10-23T16:45:00.000Z',
    });
    request.flush(appointmentResource('a-9'), { status: 201, statusText: 'Created' });
    expect((await result).id).toBe('a-9');
  });

  it('leaves the member out so pibble chooses one (B17)', () => {
    api
      .book(
        { customerId: 'c-1', serviceId: 's-1', staffMemberId: null, start: new Date(0) },
        'key-5',
      )
      .subscribe();
    const request = backend.expectOne(`${API}/api/v1/appointments`);
    expect(request.request.body).not.toHaveProperty('staffMemberId');
    request.flush(appointmentResource('a-9'));
  });

  it('reschedules, keeping the member when none is given (B13)', async () => {
    const result = firstValueFrom(
      api.reschedule(
        'a-1',
        { start: new Date('2026-10-24T15:00:00Z'), staffMemberId: null },
        'key-6',
      ),
    );
    const request = backend.expectOne(`${API}/api/v1/appointments/a-1/reschedulings`);
    expect(request.request.method).toBe('POST');
    expect(request.request.headers.get('Idempotency-Key')).toBe('key-6');
    expect(request.request.body).toEqual({ start: '2026-10-24T15:00:00.000Z' });
    request.flush(appointmentResource('a-1', { start: '2026-10-24T15:00:00Z' }));
    expect((await result).start.toISOString()).toBe('2026-10-24T15:00:00.000Z');
  });

  it('surfaces a taken slot', async () => {
    const result = firstValueFrom(
      api.book(
        { customerId: 'c-1', serviceId: 's-1', staffMemberId: null, start: new Date(0) },
        'key-7',
      ),
    );
    backend
      .expectOne(`${API}/api/v1/appointments`)
      .flush({ code: 'SLOT_UNAVAILABLE', message: 'x' }, { status: 409, statusText: 'Conflict' });
    await expect(result).rejects.toMatchObject({ code: 'SLOT_UNAVAILABLE', retryable: false });
  });
});
