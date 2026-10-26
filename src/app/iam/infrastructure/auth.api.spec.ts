import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '../../shared/infrastructure/http/api-base-url';
import { ANONYMOUS } from './anonymous';
import { AuthApi } from './auth.api';

const API = 'http://api.test';

describe('AuthApi', () => {
  let api: AuthApi;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: API },
      ],
    });
    api = TestBed.inject(AuthApi);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('requests a sign-in code without a token or idempotency key', async () => {
    const call = firstValueFrom(api.requestCode('luis@donlucho.pe'), { defaultValue: undefined });

    const request = backend.expectOne(`${API}/api/v1/auth/login-codes`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ email: 'luis@donlucho.pe' });
    expect(request.request.context.get(ANONYMOUS)).toBe(true);
    expect(request.request.headers.has('Idempotency-Key')).toBe(false);
    request.flush(null, { status: 202, statusText: 'Accepted' });
    await call;
  });

  it('signs in and maps the session', async () => {
    const call = firstValueFrom(api.signIn('luis@donlucho.pe', '042917'));

    const request = backend.expectOne(`${API}/api/v1/auth/sessions`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ email: 'luis@donlucho.pe', code: '042917' });
    expect(request.request.context.get(ANONYMOUS)).toBe(true);
    request.flush({
      sessionId: 's-1',
      accessToken: 'access',
      accessTokenExpiresAt: '2026-10-23T15:15:00Z',
      refreshToken: 'refresh',
      refreshTokenExpiresAt: '2026-11-22T15:00:00Z',
      user: { id: 'u-1', email: 'luis@donlucho.pe' },
    });

    const session = await call;
    expect(session.id).toBe('s-1');
    expect(session.accessTokenExpiresAt).toEqual(new Date('2026-10-23T15:15:00Z'));
    expect(session.user.name).toBeNull();
    expect(session.user.displayName).toBe('luis@donlucho.pe');
  });

  it('refreshes with the refresh token', () => {
    api.refresh('refresh-1').subscribe();

    const request = backend.expectOne(`${API}/api/v1/auth/session-refreshes`);
    expect(request.request.body).toEqual({ refreshToken: 'refresh-1' });
    expect(request.request.context.get(ANONYMOUS)).toBe(true);
    request.flush({
      sessionId: 's-1',
      accessToken: 'access-2',
      accessTokenExpiresAt: '2026-10-23T15:30:00Z',
      refreshToken: 'refresh-2',
      user: { id: 'u-1', email: 'luis@donlucho.pe' },
    });
  });

  it('ends a session with its token', () => {
    api.endSession('s-1').subscribe();

    const request = backend.expectOne(`${API}/api/v1/auth/sessions/s-1`);
    expect(request.request.method).toBe('DELETE');
    expect(request.request.context.get(ANONYMOUS)).toBe(false);
    request.flush(null, { status: 204, statusText: 'No Content' });
  });

  it('I5: lists the devices with their last use and which one is this', async () => {
    const call = firstValueFrom(api.listSessions());

    const request = backend.expectOne(`${API}/api/v1/auth/sessions`);
    expect(request.request.method).toBe('GET');
    expect(request.request.context.get(ANONYMOUS)).toBe(false);
    request.flush([
      {
        id: 's-1',
        lastUsedAt: '2026-10-26T14:00:00Z',
        expiresAt: '2026-11-25T14:00:00Z',
        current: true,
      },
      { id: 's-2', lastUsedAt: '2026-10-20T09:00:00Z', expiresAt: '2026-11-19T09:00:00Z' },
    ]);

    const [current, other] = await call;
    expect(current).toMatchObject({ id: 's-1', current: true });
    expect(current.lastUsedAt).toEqual(new Date('2026-10-26T14:00:00Z'));
    expect(other.current).toBe(false);
  });
});
