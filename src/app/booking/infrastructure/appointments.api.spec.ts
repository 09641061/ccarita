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
});
