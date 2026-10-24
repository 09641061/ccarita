import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { settle } from '../../../testing/settle';
import { API_BASE_URL } from '../../shared/infrastructure/http/api-base-url';
import { apiErrorInterceptor } from '../../shared/infrastructure/http/api-error.interceptor';
import { idempotencyInterceptor } from '../../shared/infrastructure/http/idempotency';
import { TenantContext } from '../../shared/infrastructure/tenancy/tenant-context';
import { tenantInterceptor } from '../../shared/infrastructure/tenancy/tenant.interceptor';
import { Session } from '../domain/model/session';
import { SessionUser } from '../domain/model/session-user';
import { authInterceptor } from './auth.interceptor';
import { SessionHolder } from './session-holder';

const API = 'http://api.test';
const REFRESH = `${API}/api/v1/auth/session-refreshes`;
const CUSTOMERS = `${API}/api/v1/customers`;

function tokens(access: string, refresh: string) {
  return {
    sessionId: 's-1',
    accessToken: access,
    accessTokenExpiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
    refreshToken: refresh,
    refreshTokenExpiresAt: new Date(Date.now() + 30 * 86_400_000).toISOString(),
    user: { id: 'u-1', email: 'luis@donlucho.pe', name: 'Luis Ramírez' },
  };
}

const unauthorized = { status: 401, statusText: 'Unauthorized' };

describe('authInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let holder: SessionHolder;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(
          withInterceptors([
            authInterceptor,
            tenantInterceptor,
            idempotencyInterceptor,
            apiErrorInterceptor,
          ]),
        ),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: API },
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
    holder = TestBed.inject(SessionHolder);
  });

  afterEach(() => backend.verify());

  function signIn(access = 'access-1', refresh = 'refresh-1'): void {
    holder.start(
      new Session(
        's-1',
        new SessionUser('u-1', 'luis@donlucho.pe', null),
        access,
        new Date(Date.now() + 15 * 60_000),
        refresh,
      ),
    );
  }

  it('sends the access token to pibble and to no other origin', async () => {
    signIn();

    http.get(CUSTOMERS).subscribe();
    http.get('https://elsewhere.test/api/v1/customers').subscribe();
    await settle();

    expect(backend.expectOne(CUSTOMERS).request.headers.get('Authorization')).toBe(
      'Bearer access-1',
    );
    expect(
      backend
        .expectOne('https://elsewhere.test/api/v1/customers')
        .request.headers.has('Authorization'),
    ).toBe(false);
  });

  it('refreshes once on a 401 and sends the request again with the new token', async () => {
    signIn();
    const call = firstValueFrom(http.get(CUSTOMERS));
    await settle();

    backend.expectOne(CUSTOMERS).flush({ code: 'UNAUTHENTICATED', message: 'x' }, unauthorized);
    await settle();
    const refresh = backend.expectOne(REFRESH);
    expect(refresh.request.body).toEqual({ refreshToken: 'refresh-1' });
    expect(refresh.request.headers.has('Authorization')).toBe(false);
    refresh.flush(tokens('access-2', 'refresh-2'));
    await settle();

    const replay = backend.expectOne(CUSTOMERS);
    expect(replay.request.headers.get('Authorization')).toBe('Bearer access-2');
    replay.flush([]);
    await expect(call).resolves.toEqual([]);
    expect(localStorage.getItem('ccarita.refreshToken')).toBe('refresh-2');
  });

  it('runs one refresh for two requests rejected at the same time', async () => {
    signIn();
    const first = firstValueFrom(http.get(CUSTOMERS));
    const second = firstValueFrom(http.get(`${API}/api/v1/members`));
    await settle();

    backend.expectOne(CUSTOMERS).flush({ code: 'UNAUTHENTICATED', message: 'x' }, unauthorized);
    backend
      .expectOne(`${API}/api/v1/members`)
      .flush({ code: 'UNAUTHENTICATED', message: 'x' }, unauthorized);
    await settle();
    backend.expectOne(REFRESH).flush(tokens('access-2', 'refresh-2'));
    await settle();

    backend.expectOne(CUSTOMERS).flush([]);
    backend.expectOne(`${API}/api/v1/members`).flush([]);
    await expect(first).resolves.toEqual([]);
    await expect(second).resolves.toEqual([]);
  });

  it('signs out and stores nothing when pibble refuses the refresh', async () => {
    signIn();
    TestBed.inject(TenantContext).selectOrganization('org-1');
    const call = firstValueFrom(http.get(CUSTOMERS));
    await settle();

    backend.expectOne(CUSTOMERS).flush({ code: 'UNAUTHENTICATED', message: 'x' }, unauthorized);
    await settle();
    backend.expectOne(REFRESH).flush({ code: 'REFRESH_TOKEN_INVALID', message: 'x' }, unauthorized);

    await expect(call).rejects.toMatchObject({ status: 401, code: 'UNAUTHENTICATED' });
    expect(holder.session()).toBeNull();
    expect(localStorage.getItem('ccarita.refreshToken')).toBeNull();
    expect(TestBed.inject(TenantContext).organizationId()).toBeNull();
  });

  it('restores the session from the stored refresh token before the first request', async () => {
    localStorage.setItem('ccarita.refreshToken', 'refresh-1');
    http.get(CUSTOMERS).subscribe();
    await settle();

    backend.expectOne(REFRESH).flush(tokens('access-2', 'refresh-2'));
    await settle();

    expect(backend.expectOne(CUSTOMERS).request.headers.get('Authorization')).toBe(
      'Bearer access-2',
    );
  });

  it('keeps the stored session when pibble cannot be reached', async () => {
    localStorage.setItem('ccarita.refreshToken', 'refresh-1');
    const call = firstValueFrom(http.get(CUSTOMERS));
    await settle();

    backend.expectOne(REFRESH).error(new ProgressEvent('error'));

    await expect(call).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
    expect(localStorage.getItem('ccarita.refreshToken')).toBe('refresh-1');
  });

  it('passes a 401 through when there is no session', async () => {
    const call = firstValueFrom(http.get(CUSTOMERS));
    await settle();

    const request = backend.expectOne(CUSTOMERS);
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush({ code: 'UNAUTHENTICATED', message: 'x' }, unauthorized);

    await expect(call).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
  });
});
