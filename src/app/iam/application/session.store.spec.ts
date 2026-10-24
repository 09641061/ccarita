import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { settle } from '../../../testing/settle';
import { API_BASE_URL } from '../../shared/infrastructure/http/api-base-url';
import { apiErrorInterceptor } from '../../shared/infrastructure/http/api-error.interceptor';
import { TenantContext } from '../../shared/infrastructure/tenancy/tenant-context';
import { authInterceptor } from '../infrastructure/auth.interceptor';
import { SessionStore } from './session.store';

const API = 'http://api.test';
const signedIn = {
  sessionId: 's-1',
  accessToken: 'access-1',
  accessTokenExpiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
  refreshToken: 'refresh-1',
  user: { id: 'u-1', email: 'luis@donlucho.pe', name: 'Luis Ramírez' },
};

describe('SessionStore', () => {
  let store: SessionStore;
  let backend: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor, apiErrorInterceptor])),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: API },
      ],
    });
    store = TestBed.inject(SessionStore);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  async function signIn(): Promise<void> {
    const done = store.signIn('luis@donlucho.pe', '042917');
    await settle();
    backend
      .expectOne(`${API}/api/v1/auth/sessions`)
      .flush(signedIn, { status: 201, statusText: '' });
    await done;
  }

  it('keeps the user and stores only the refresh token after signing in', async () => {
    await signIn();

    expect(store.isSignedIn()).toBe(true);
    expect(store.user()?.displayName).toBe('Luis Ramírez');
    expect(localStorage.getItem('ccarita.refreshToken')).toBe('refresh-1');
    expect(JSON.stringify(localStorage)).not.toContain('access-1');
  });

  it('surfaces a wrong code as LOGIN_CODE_INVALID and stays signed out', async () => {
    const done = store.signIn('luis@donlucho.pe', '000000');
    await settle();
    backend
      .expectOne(`${API}/api/v1/auth/sessions`)
      .flush({ code: 'LOGIN_CODE_INVALID', message: 'x' }, { status: 401, statusText: '' });

    await expect(done).rejects.toMatchObject({ code: 'LOGIN_CODE_INVALID' });
    expect(store.isSignedIn()).toBe(false);
  });

  it('ends the session in pibble and forgets tokens and organization on sign-out', async () => {
    await signIn();
    TestBed.inject(TenantContext).selectOrganization('org-1');

    const done = store.signOut();
    await settle();
    const request = backend.expectOne(`${API}/api/v1/auth/sessions/s-1`);
    expect(request.request.method).toBe('DELETE');
    expect(request.request.headers.get('Authorization')).toBe('Bearer access-1');
    request.flush(null, { status: 204, statusText: '' });
    await done;

    expect(store.isSignedIn()).toBe(false);
    expect(localStorage.getItem('ccarita.refreshToken')).toBeNull();
    expect(TestBed.inject(TenantContext).organizationId()).toBeNull();
  });

  it('signs out locally even when pibble cannot be reached', async () => {
    await signIn();

    const done = store.signOut();
    await settle();
    backend.expectOne(`${API}/api/v1/auth/sessions/s-1`).error(new ProgressEvent('error'));
    await done;

    expect(localStorage.getItem('ccarita.refreshToken')).toBeNull();
  });

  it('restores nothing without a stored refresh token', async () => {
    await expect(store.restore()).resolves.toBe(false);
  });
});
