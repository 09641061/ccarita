import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { memberResource, serviceResource } from '../../../testing/organization-fixtures';
import { settle } from '../../../testing/settle';
import { ApiError } from '../../shared/domain/model/api-error';
import { API_BASE_URL } from '../../shared/infrastructure/http/api-base-url';
import { apiErrorInterceptor } from '../../shared/infrastructure/http/api-error.interceptor';
import { idempotencyInterceptor } from '../../shared/infrastructure/http/idempotency';
import { CurrentEstablishment } from './current-establishment.store';
import { CurrentOrganization } from './current-organization.store';
import { TeamStore } from './team.store';

const API = 'http://api.test';
const MEMBERS = `${API}/api/v1/members`;
const SERVICES = `${API}/api/v1/establishments/est-1/services`;

describe('TeamStore', () => {
  let backend: HttpTestingController;
  let store: TeamStore;
  let load: ReturnType<typeof vi.fn>;
  const role = signal<'owner' | 'manager' | 'staff'>('owner');

  beforeEach(async () => {
    role.set('owner');
    load = vi.fn(async () => {
      role.set('manager');
      return [];
    });
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([idempotencyInterceptor, apiErrorInterceptor])),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: API },
        {
          provide: CurrentOrganization,
          useValue: { selected: signal({ id: 'org-1' }), memberId: signal('m-owner'), role, load },
        },
        { provide: CurrentEstablishment, useValue: { id: signal('est-1') } },
      ],
    });
    backend = TestBed.inject(HttpTestingController);
    store = TestBed.inject(TeamStore);
    TestBed.tick();
    backend.expectOne(MEMBERS).flush([memberResource('m-owner', { role: 'owner' })]);
    backend.expectOne(SERVICES).flush([serviceResource('s-1')]);
    await settle();
  });

  afterEach(() => backend.verify());

  async function reloaded(services = false) {
    TestBed.tick();
    backend.expectOne(MEMBERS).flush([memberResource('m-owner', { role: 'owner' })]);
    if (services) backend.expectOne(SERVICES).flush([]);
    await settle();
  }

  it('knows the caller from the selected organization', () => {
    expect(store.caller()).toMatchObject({ memberId: 'm-owner', role: 'owner' });
  });

  it('O10: invites with the key and reloads the team', async () => {
    const invited = store.invite(
      {
        email: 'a@example.com',
        displayName: 'A',
        role: 'staff',
        bookable: true,
        establishmentIds: ['est-1'],
      },
      'key-1',
    );
    const post = backend.expectOne(MEMBERS);
    expect(post.request.headers.get('Idempotency-Key')).toBe('key-1');
    post.flush(memberResource('m-1', { status: 'pending' }), { status: 201, statusText: '' });
    await invited;
    await reloaded();
  });

  it('O15: reloads the team and the services after an edit or a removal', async () => {
    const updated = store.update('m-1', {
      displayName: 'A',
      bookable: false,
      role: 'staff',
      establishmentIds: ['est-1'],
    });
    backend.expectOne(`${MEMBERS}/m-1`).flush(memberResource('m-1', { bookable: false }));
    await updated;
    await reloaded(true);

    const removed = store.remove('m-1');
    backend.expectOne(`${MEMBERS}/m-1`).flush(null, { status: 204, statusText: '' });
    await removed;
    await reloaded(true);
  });

  it('O10: sends an invitation again and reloads the team', async () => {
    const renewed = store.renewInvitation('m-1', 'key-2');
    const post = backend.expectOne(`${MEMBERS}/m-1/invitation-renewals`);
    expect(post.request.headers.get('Idempotency-Key')).toBe('key-2');
    post.flush(memberResource('m-1', { status: 'pending' }));
    await renewed;
    await reloaded();
  });

  it('O12: rereads the memberships after a transfer, so the caller is a manager', async () => {
    const transferred = store.transferOwnership('m-2', 'key-3');
    backend
      .expectOne(`${API}/api/v1/ownership-transfers`)
      .flush(memberResource('m-2', { role: 'owner' }), { status: 201, statusText: '' });
    await transferred;
    await reloaded();

    expect(load).toHaveBeenCalledWith(true);
    expect(store.caller()?.role).toBe('manager');
  });

  it("surfaces pibble's code as an ApiError and changes nothing", async () => {
    const removed = store.remove('m-1');
    backend
      .expectOne(`${MEMBERS}/m-1`)
      .flush(
        { code: 'MEMBER_HAS_UPCOMING_APPOINTMENTS' },
        { status: 422, statusText: 'Unprocessable' },
      );

    const error = await removed.catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe('MEMBER_HAS_UPCOMING_APPOINTMENTS');
  });
});
