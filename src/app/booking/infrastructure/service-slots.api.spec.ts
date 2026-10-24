import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { LocalDate } from '../../shared/domain/model/local-date';
import { API_BASE_URL } from '../../shared/infrastructure/http/api-base-url';
import { apiErrorInterceptor } from '../../shared/infrastructure/http/api-error.interceptor';
import { ServiceSlotsApi } from './service-slots.api';

const API = 'http://api.test';

describe('ServiceSlotsApi', () => {
  let backend: HttpTestingController;
  let api: ServiceSlotsApi;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiErrorInterceptor])),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: API },
      ],
    });
    backend = TestBed.inject(HttpTestingController);
    api = TestBed.inject(ServiceSlotsApi);
  });

  afterEach(() => backend.verify());

  it('asks for a local date and the customer, and maps the free members', async () => {
    const result = firstValueFrom(api.list('s-1', LocalDate.parse('2026-10-23'), 'c-1'));
    const request = backend.expectOne((r) => r.url === `${API}/api/v1/services/s-1/slots`);
    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('date')).toBe('2026-10-23');
    expect(request.request.params.get('customerId')).toBe('c-1');
    expect(request.request.params.has('staffMemberId')).toBe(false);
    request.flush([
      { start: '2026-10-23T16:45:00Z', end: '2026-10-23T17:30:00Z', freeMemberIds: ['m-1', 'm-2'] },
    ]);

    const [slot] = await result;
    expect(slot.start.toISOString()).toBe('2026-10-23T16:45:00.000Z');
    expect(slot.freeMemberIds).toEqual(['m-1', 'm-2']);
  });

  it('leaves the customer out when nobody is chosen', () => {
    api.list('s-1', LocalDate.parse('2026-10-23'), null).subscribe();
    const request = backend.expectOne((r) => r.url === `${API}/api/v1/services/s-1/slots`);
    expect(request.request.params.has('customerId')).toBe(false);
    request.flush([]);
  });
});
