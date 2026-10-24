import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { settle } from '../../../testing/settle';
import { API_BASE_URL } from '../../shared/infrastructure/http/api-base-url';
import { apiErrorInterceptor } from '../../shared/infrastructure/http/api-error.interceptor';
import { TenantContext } from '../../shared/infrastructure/tenancy/tenant-context';
import { CustomerDirectory } from './customer-directory.store';
import { CustomerListStore } from './customer-list.store';
import { SEARCH_DELAY_MS } from './customer-search.store';

const API = 'http://api.test';
const typingPause = () => new Promise((resolve) => setTimeout(resolve, SEARCH_DELAY_MS + 20));
const page = (n: number, hasMore: boolean, items: unknown[] = []) => ({
  items,
  page: n,
  size: 20,
  hasMore,
});

describe('CustomerListStore', () => {
  let backend: HttpTestingController;
  let list: CustomerListStore;
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
    tenant = TestBed.inject(TenantContext);
    tenant.selectOrganization('org-1');
    list = TestBed.inject(CustomerListStore);
  });

  afterEach(() => backend.verify());

  const requests = () => backend.match((r) => r.url === `${API}/api/v1/customers`);
  const flushOne = async (body: object) => {
    TestBed.tick();
    await settle();
    const [request, ...rest] = requests();
    expect(rest).toHaveLength(0);
    request.flush(body);
    await settle();
    return request;
  };

  it('moves between pages while there are more, without a total', async () => {
    const first = await flushOne(
      page(0, true, [{ id: 'c-1', phone: '+51987654321', displayName: 'Rosa' }]),
    );
    expect(first.request.params.get('page')).toBe('0');
    expect(first.request.params.get('size')).toBe('20');
    expect(TestBed.inject(CustomerDirectory).customers().has('c-1')).toBe(true);

    list.previous();
    TestBed.tick();
    expect(requests()).toHaveLength(0);

    list.next();
    const second = await flushOne(page(1, false));
    expect(second.request.params.get('page')).toBe('1');

    list.next();
    TestBed.tick();
    expect(requests()).toHaveLength(0);
    expect(list.page()).toBe(1);

    list.previous();
    const back = await flushOne(page(0, true));
    expect(back.request.params.get('page')).toBe('0');
  });

  it('starts a new search at the first page once typing pauses', async () => {
    await flushOne(page(0, true));
    list.next();
    await flushOne(page(1, true));

    list.search('987');
    TestBed.tick();
    expect(list.page()).toBe(0);
    await typingPause();
    const [typed] = requests();
    expect(typed.request.params.get('q')).toBe('987');
    expect(typed.request.params.get('page')).toBe('0');
    typed.flush(page(0, false));
  });

  it('starts over in another organization', async () => {
    await flushOne(page(0, true));
    list.next();
    await flushOne(page(1, true));

    tenant.selectOrganization('org-2');
    const request = await flushOne(page(0, false));
    expect(list.page()).toBe(0);
    expect(request.request.params.get('page')).toBe('0');
  });
});
