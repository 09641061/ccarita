import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { settle } from '../../../testing/settle';
import { API_BASE_URL } from '../../shared/infrastructure/http/api-base-url';
import { apiErrorInterceptor } from '../../shared/infrastructure/http/api-error.interceptor';
import { idempotencyInterceptor } from '../../shared/infrastructure/http/idempotency';
import { TenantContext } from '../../shared/infrastructure/tenancy/tenant-context';
import { CustomerDirectory } from './customer-directory.store';
import { CustomerSearch, SEARCH_DELAY_MS } from './customer-search.store';

const API = 'http://api.test';
const typingPause = () => new Promise((resolve) => setTimeout(resolve, SEARCH_DELAY_MS + 20));
const page = (items: unknown[]) => ({ items, page: 0, size: 20, hasMore: false });

describe('CustomerSearch', () => {
  let backend: HttpTestingController;
  let search: CustomerSearch;
  let directory: CustomerDirectory;

  beforeEach(() => {
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
    search = TestBed.inject(CustomerSearch);
    directory = TestBed.inject(CustomerDirectory);
  });

  afterEach(() => backend.verify());

  const searches = () =>
    backend.match((r) => r.url === `${API}/api/v1/customers` && r.method === 'GET');

  it('lists customers at once, then searches once typing pauses', async () => {
    TestBed.tick();
    await settle();
    const [first] = searches();
    expect(first.request.params.has('q')).toBe(false);
    first.flush(page([]));

    search.search('Ro');
    TestBed.tick();
    search.search('Rosa');
    TestBed.tick();
    await typingPause();
    const [typed, ...rest] = searches();
    expect(rest).toHaveLength(0);
    expect(typed.request.params.get('q')).toBe('Rosa');
    typed.flush(page([{ id: 'c-1', phone: '+51987654321', displayName: 'Rosa Huamán' }]));
    await settle();

    expect(search.results.value()?.items[0].displayName).toBe('Rosa Huamán');
    expect(directory.customers().get('c-1')).toMatchObject({ displayName: 'Rosa Huamán' });
  });

  it('registers a customer and keeps it in the directory', async () => {
    TestBed.tick();
    searches().forEach((r) => r.flush(page([])));
    const registered = search.register({ phone: '987654321', name: null }, 'key-1');
    const request = backend.expectOne((r) => r.method === 'POST');
    expect(request.request.headers.get('Idempotency-Key')).toBe('key-1');
    request.flush({ id: 'c-9', phone: '+51987654321', displayName: '+51987654321' });

    expect((await registered).id).toBe('c-9');
    expect(directory.customers().get('c-9')).toMatchObject({ phone: '+51987654321' });
  });
});
