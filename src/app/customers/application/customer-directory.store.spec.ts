import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { settle } from '../../../testing/settle';
import { API_BASE_URL } from '../../shared/infrastructure/http/api-base-url';
import { apiErrorInterceptor } from '../../shared/infrastructure/http/api-error.interceptor';
import { TenantContext } from '../../shared/infrastructure/tenancy/tenant-context';
import { CustomerDirectory } from './customer-directory.store';

const API = 'http://api.test';

describe('CustomerDirectory', () => {
  let backend: HttpTestingController;
  let directory: CustomerDirectory;
  let tenant: TenantContext;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiErrorInterceptor])),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: API },
      ],
    });
    backend = TestBed.inject(HttpTestingController);
    directory = TestBed.inject(CustomerDirectory);
    tenant = TestBed.inject(TenantContext);
    tenant.selectOrganization('org-1');
  });

  afterEach(() => backend.verify());

  it('reads each customer once', async () => {
    directory.want(['c-1', 'c-1']);
    directory.want(['c-1']);
    backend
      .expectOne(`${API}/api/v1/customers/c-1`)
      .flush({ id: 'c-1', phone: '+51987654321', displayName: 'Rosa Huamán' });
    await settle();

    const customer = directory.customers().get('c-1');
    expect(customer).toMatchObject({ displayName: 'Rosa Huamán', phone: '+51987654321' });
    directory.want(['c-1']);
    backend.expectNone(`${API}/api/v1/customers/c-1`);
  });

  it('remembers a deleted customer and retries other failures', async () => {
    directory.want(['c-gone', 'c-flaky']);
    backend
      .expectOne(`${API}/api/v1/customers/c-gone`)
      .flush({ code: 'CUSTOMER_NOT_FOUND' }, { status: 404, statusText: 'Not Found' });
    backend
      .expectOne(`${API}/api/v1/customers/c-flaky`)
      .flush({ code: 'UNEXPECTED_ERROR' }, { status: 500, statusText: 'Error' });
    await settle();

    expect(directory.customers().get('c-gone')).toBe('deleted');
    expect(directory.customers().has('c-flaky')).toBe(false);
    directory.want(['c-flaky']);
    backend
      .expectOne(`${API}/api/v1/customers/c-flaky`)
      .flush({ id: 'c-flaky', phone: '+51900000000' });
    await settle();
    expect(directory.customers().get('c-flaky')).toMatchObject({ displayName: '+51900000000' });
  });

  it('forgets customers of another organization', async () => {
    directory.want(['c-1']);
    backend.expectOne(`${API}/api/v1/customers/c-1`).flush({ id: 'c-1', phone: '+51987654321' });
    await settle();

    tenant.selectOrganization('org-2');
    expect(directory.customers().size).toBe(0);
  });
});
