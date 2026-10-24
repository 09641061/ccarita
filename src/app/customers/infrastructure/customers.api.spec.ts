import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '../../shared/infrastructure/http/api-base-url';
import { apiErrorInterceptor } from '../../shared/infrastructure/http/api-error.interceptor';
import { idempotencyInterceptor } from '../../shared/infrastructure/http/idempotency';
import { CustomersApi } from './customers.api';

const API = 'http://api.test';

describe('CustomersApi', () => {
  let backend: HttpTestingController;
  let api: CustomersApi;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([idempotencyInterceptor, apiErrorInterceptor])),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: API },
      ],
    });
    backend = TestBed.inject(HttpTestingController);
    api = TestBed.inject(CustomersApi);
  });

  afterEach(() => backend.verify());

  it('searches a page by text', async () => {
    const result = firstValueFrom(api.search('987', 0, 20));
    const request = backend.expectOne((r) => r.url === `${API}/api/v1/customers`);
    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('q')).toBe('987');
    expect(request.request.params.get('page')).toBe('0');
    expect(request.request.params.get('size')).toBe('20');
    request.flush({
      items: [{ id: 'c-1', phone: '+51987654321', displayName: 'Rosa Huamán' }],
      page: 0,
      size: 20,
      hasMore: true,
    });

    const page = await result;
    expect(page.items[0].displayName).toBe('Rosa Huamán');
    expect(page.hasMore).toBe(true);
  });

  it('leaves an empty text out', () => {
    api.search('', 0, 20).subscribe();
    const request = backend.expectOne((r) => r.url === `${API}/api/v1/customers`);
    expect(request.request.params.has('q')).toBe(false);
    request.flush({ items: [], page: 0, size: 20, hasMore: false });
  });

  it('registers by phone with the idempotency key', async () => {
    const result = firstValueFrom(api.register({ phone: ' 987 654 321 ', name: '  ' }, 'key-1'));
    const request = backend.expectOne(`${API}/api/v1/customers`);
    expect(request.request.method).toBe('POST');
    expect(request.request.headers.get('Idempotency-Key')).toBe('key-1');
    expect(request.request.body).toEqual({ phone: '987 654 321' });
    request.flush(
      { id: 'c-2', phone: '+51987654321', displayName: '+51987654321' },
      { status: 201, statusText: 'Created' },
    );
    expect((await result).phone).toBe('+51987654321');
  });

  it('surfaces a phone that is taken (C1)', async () => {
    const result = firstValueFrom(api.register({ phone: '987654321', name: 'Rosa' }, 'key-2'));
    const request = backend.expectOne(`${API}/api/v1/customers`);
    expect(request.request.body).toEqual({ phone: '987654321', name: 'Rosa' });
    request.flush(
      { code: 'CUSTOMER_CONFLICT', message: 'x' },
      { status: 409, statusText: 'Conflict' },
    );
    await expect(result).rejects.toMatchObject({ code: 'CUSTOMER_CONFLICT' });
  });
});
