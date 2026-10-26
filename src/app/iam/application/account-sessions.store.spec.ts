import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { settle } from '../../../testing/settle';
import { API_BASE_URL } from '../../shared/infrastructure/http/api-base-url';
import { AccountSession } from '../domain/model/account-session';
import { AccountSessionsStore } from './account-sessions.store';
import { SessionStore } from './session.store';

const API = 'http://api.test';
const SESSIONS = `${API}/api/v1/auth/sessions`;
const resource = (id: string, current = false) => ({
  id,
  lastUsedAt: '2026-10-26T14:00:00Z',
  expiresAt: '2026-11-25T14:00:00Z',
  current,
});

describe('AccountSessionsStore', () => {
  let backend: HttpTestingController;
  let store: AccountSessionsStore;
  let signOut: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    signOut = vi.fn(async () => undefined);
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: API },
        { provide: SessionStore, useValue: { user: signal({ id: 'u-1' }), signOut } },
      ],
    });
    backend = TestBed.inject(HttpTestingController);
    store = TestBed.inject(AccountSessionsStore);
    TestBed.tick();
    backend.expectOne(SESSIONS).flush([resource('s-1', true), resource('s-2')]);
    await settle();
  });

  afterEach(() => backend.verify());

  it('I5: lists the devices', () => {
    expect(store.sessions.value().map((s) => [s.id, s.current])).toEqual([
      ['s-1', true],
      ['s-2', false],
    ]);
  });

  it('I5: ends another device and reloads the list', async () => {
    const done = store.signOut(store.sessions.value()[1]);
    const request = backend.expectOne(`${SESSIONS}/s-2`);
    expect(request.request.method).toBe('DELETE');
    request.flush(null, { status: 204, statusText: '' });
    await done;
    TestBed.tick();
    backend.expectOne(SESSIONS).flush([resource('s-1', true)]);
    await settle();

    expect(store.sessions.value()).toHaveLength(1);
    expect(signOut).not.toHaveBeenCalled();
  });

  it('signs this device out through the session, which forgets its tokens', async () => {
    await store.signOut(new AccountSession('s-1', new Date(), new Date(), true));

    expect(signOut).toHaveBeenCalled();
  });
});
