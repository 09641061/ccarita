import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { TenantContext } from '../tenancy/tenant-context';
import { tenantInterceptor } from '../tenancy/tenant.interceptor';
import { API_BASE_URL } from './api-base-url';
import { ApiError } from '../../domain/model/api-error';
import { apiErrorInterceptor } from './api-error.interceptor';
import { idempotencyInterceptor, idempotent } from './idempotency';

const API = 'http://api.test';

describe('HTTP interceptors', () => {
  let http: HttpClient;
  let backend: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(
          withInterceptors([tenantInterceptor, idempotencyInterceptor, apiErrorInterceptor]),
        ),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: API },
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('sends the selected organization to pibble’s API only', () => {
    TestBed.inject(TenantContext).selectOrganization('org-1');

    http.get(`${API}/api/v1/customers`).subscribe();
    http.get('https://elsewhere.test/api/v1/x').subscribe();

    expect(
      backend.expectOne(`${API}/api/v1/customers`).request.headers.get('X-Organization-Id'),
    ).toBe('org-1');
    expect(
      backend.expectOne('https://elsewhere.test/api/v1/x').request.headers.has('X-Organization-Id'),
    ).toBe(false);
  });

  it('sends the idempotency key of the action', () => {
    http.post(`${API}/api/v1/appointments`, {}, { context: idempotent('key-1') }).subscribe();

    expect(
      backend.expectOne(`${API}/api/v1/appointments`).request.headers.get('Idempotency-Key'),
    ).toBe('key-1');
  });

  it('turns a failed call into an ApiError', async () => {
    const call = firstValueFrom(http.get(`${API}/api/v1/customers`));
    backend
      .expectOne(`${API}/api/v1/customers`)
      .flush({ code: 'PLAN_INACTIVE', message: 'x' }, { status: 402, statusText: '' });

    await expect(call).rejects.toMatchObject({ code: 'PLAN_INACTIVE', status: 402 });
    await expect(call).rejects.toBeInstanceOf(ApiError);
  });
});
