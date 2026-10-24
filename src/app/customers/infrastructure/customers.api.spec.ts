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

  it('reads the whole profile', async () => {
    const result = firstValueFrom(api.get('c-1'));
    backend.expectOne(`${API}/api/v1/customers/c-1`).flush({
      id: 'c-1',
      phone: '+51987654321',
      displayName: 'Rosa Huamán',
      name: 'Rosa Huamán',
      whatsappProfileName: 'Rosita H.',
      documentType: 'dni',
      documentNumber: '45678912',
      notes: 'Prefiere los sábados',
    });
    const profile = await result;
    expect(profile.document).toEqual({ type: 'dni', number: '45678912' });
    expect(profile.otherWhatsappName).toBe('Rosita H.');
    expect(profile.notes).toBe('Prefiere los sábados');
  });

  it('registers with the optional details (C4)', () => {
    api
      .register(
        {
          phone: '987654321',
          name: 'Rosa',
          documentType: 'dni',
          documentNumber: ' 45678912 ',
          notes: ' Prefiere los sábados ',
        },
        'key-3',
      )
      .subscribe();
    const request = backend.expectOne(`${API}/api/v1/customers`);
    expect(request.request.body).toEqual({
      phone: '987654321',
      name: 'Rosa',
      documentType: 'dni',
      documentNumber: '45678912',
      notes: 'Prefiere los sábados',
    });
    request.flush({ id: 'c-3', phone: '+51987654321' }, { status: 201, statusText: 'Created' });
  });

  it('updates with the whole form and leaves cleared fields out, without a key', async () => {
    const result = firstValueFrom(
      api.update('c-1', { name: '  ', documentType: null, documentNumber: '', notes: 'VIP' }),
    );
    const request = backend.expectOne(`${API}/api/v1/customers/c-1`);
    expect(request.request.method).toBe('PUT');
    expect(request.request.headers.has('Idempotency-Key')).toBe(false);
    expect(request.request.body).toEqual({ notes: 'VIP' });
    request.flush({ id: 'c-1', phone: '+51987654321', displayName: '+51987654321', notes: 'VIP' });
    const profile = await result;
    expect(profile.name).toBeNull();
    expect(profile.document).toBeNull();
  });

  it('sends a whole document on update', () => {
    api
      .update('c-1', {
        name: 'Rosa',
        documentType: 'ruc',
        documentNumber: '10456789123',
        notes: '',
      })
      .subscribe();
    const request = backend.expectOne(`${API}/api/v1/customers/c-1`);
    expect(request.request.body).toEqual({
      name: 'Rosa',
      documentType: 'ruc',
      documentNumber: '10456789123',
    });
    request.flush({ id: 'c-1', phone: '+51987654321' });
  });

  it('deletes a customer (C5)', async () => {
    const result = firstValueFrom(api.delete('c-1'), { defaultValue: undefined });
    const request = backend.expectOne(`${API}/api/v1/customers/c-1`);
    expect(request.request.method).toBe('DELETE');
    request.flush(null, { status: 204, statusText: 'No Content' });
    await expect(result).resolves.toBeNull();
  });

  it('surfaces a staff member deleting', async () => {
    const result = firstValueFrom(api.delete('c-1'));
    backend
      .expectOne(`${API}/api/v1/customers/c-1`)
      .flush({ code: 'ACCESS_DENIED' }, { status: 403, statusText: 'Forbidden' });
    await expect(result).rejects.toMatchObject({ code: 'ACCESS_DENIED' });
  });
});
