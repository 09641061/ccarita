import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { settle } from '../../../testing/settle';
import { API_BASE_URL } from '../../shared/infrastructure/http/api-base-url';
import { apiErrorInterceptor } from '../../shared/infrastructure/http/api-error.interceptor';
import { idempotencyInterceptor } from '../../shared/infrastructure/http/idempotency';
import { TenantContext } from '../../shared/infrastructure/tenancy/tenant-context';
import { CustomerDetailStore } from './customer-detail.store';
import { CustomerDirectory } from './customer-directory.store';
import { CustomerListStore } from './customer-list.store';

const API = 'http://api.test';
const rosa = { id: 'c-1', phone: '+51987654321', displayName: 'Rosa', name: 'Rosa' };

describe('CustomerDetailStore', () => {
  let backend: HttpTestingController;
  let store: CustomerDetailStore;
  let directory: CustomerDirectory;
  let list: CustomerListStore;

  beforeEach(async () => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([idempotencyInterceptor, apiErrorInterceptor])),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: API },
      ],
    });
    backend = TestBed.inject(HttpTestingController);
    TestBed.inject(TenantContext).selectOrganization('org-1');
    store = TestBed.inject(CustomerDetailStore);
    directory = TestBed.inject(CustomerDirectory);
    list = TestBed.inject(CustomerListStore);
    store.open('c-1');
    TestBed.tick();
    await settle();
    backend.expectOne(`${API}/api/v1/customers/c-1`).flush(rosa);
    backend
      .match((r) => r.url === `${API}/api/v1/customers`)
      .forEach((r) => r.flush({ items: [], page: 0, size: 20, hasMore: false }));
    await settle();
    vi.spyOn(list.results, 'reload');
  });

  afterEach(() => backend.verify());

  it('reads the opened customer', () => {
    expect(store.profile.value()?.name).toBe('Rosa');
  });

  it('updates the profile, the directory and the list', async () => {
    const updated = store.update('c-1', {
      name: '',
      documentType: null,
      documentNumber: '',
      notes: '',
    });
    const request = backend.expectOne(`${API}/api/v1/customers/c-1`);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({});
    request.flush({ id: 'c-1', phone: '+51987654321', displayName: '+51987654321' });
    await updated;

    expect(store.profile.value()?.name).toBeNull();
    expect(directory.customers().get('c-1')).toMatchObject({ displayName: '+51987654321' });
    expect(list.results.reload).toHaveBeenCalled();
  });

  it('registers with its key and keeps the customer in the directory', async () => {
    const registered = store.register({ phone: '912345678', name: null }, 'key-1');
    const request = backend.expectOne((r) => r.method === 'POST');
    expect(request.request.headers.get('Idempotency-Key')).toBe('key-1');
    request.flush({ id: 'c-2', phone: '+51912345678', displayName: '+51912345678' });
    expect((await registered).id).toBe('c-2');
    expect(directory.customers().get('c-2')).toMatchObject({ phone: '+51912345678' });
    expect(list.results.reload).toHaveBeenCalled();
  });

  it('deletes and marks the customer deleted (C5)', async () => {
    const deleted = store.delete('c-1');
    backend
      .expectOne((r) => r.method === 'DELETE')
      .flush(null, { status: 204, statusText: 'No Content' });
    await deleted;
    expect(directory.customers().get('c-1')).toBe('deleted');
    expect(store.openedId()).toBeNull();
    expect(list.results.reload).toHaveBeenCalled();
  });

  it('counts a customer deleted elsewhere as deleted', async () => {
    const deleted = store.delete('c-1');
    backend
      .expectOne((r) => r.method === 'DELETE')
      .flush({ code: 'CUSTOMER_NOT_FOUND' }, { status: 404, statusText: 'Not Found' });
    await deleted;
    expect(directory.customers().get('c-1')).toBe('deleted');
  });

  it('keeps the customer when staff may not delete', async () => {
    const deleted = store.delete('c-1');
    backend
      .expectOne((r) => r.method === 'DELETE')
      .flush({ code: 'ACCESS_DENIED' }, { status: 403, statusText: 'Forbidden' });
    await expect(deleted).rejects.toMatchObject({ code: 'ACCESS_DENIED' });
    expect(directory.customers().get('c-1')).not.toBe('deleted');
    expect(store.openedId()).toBe('c-1');
  });
});
