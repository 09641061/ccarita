import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import {
  establishmentResource,
  joinedResource,
  memberResource,
  serviceResource,
} from '../../../testing/organization-fixtures';
import { API_BASE_URL } from '../../shared/infrastructure/http/api-base-url';
import { idempotencyInterceptor } from '../../shared/infrastructure/http/idempotency';
import { TenantContext } from '../../shared/infrastructure/tenancy/tenant-context';
import { tenantInterceptor } from '../../shared/infrastructure/tenancy/tenant.interceptor';
import { OpeningHours } from '../domain/model/opening-hours';
import { EstablishmentsApi } from './establishments.api';
import { InvitationAcceptancesApi } from './invitation-acceptances.api';
import { MembersApi } from './members.api';
import { OrganizationsApi } from './organizations.api';
import { OwnershipTransfersApi } from './ownership-transfers.api';
import { ServicesApi } from './services.api';

const API = 'http://api.test';

describe('organization endpoints', () => {
  let backend: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([tenantInterceptor, idempotencyInterceptor])),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: API },
      ],
    });
    backend = TestBed.inject(HttpTestingController);
    TestBed.inject(TenantContext).selectOrganization('org-1');
  });

  afterEach(() => backend.verify());

  it('lists the joined organizations with their role and plan', async () => {
    const call = firstValueFrom(TestBed.inject(OrganizationsApi).listJoined());

    const request = backend.expectOne(`${API}/api/v1/organizations`);
    expect(request.request.method).toBe('GET');
    request.flush([joinedResource('org-1', 'manager')]);

    const [organization] = await call;
    expect(organization).toMatchObject({ id: 'org-1', role: 'manager', memberId: 'm-org-1' });
    expect(organization.planActiveUntil).toEqual(new Date('2026-11-06T05:00:00Z'));
  });

  it('reads the selected organization with X-Organization-Id', async () => {
    const call = firstValueFrom(TestBed.inject(OrganizationsApi).current());

    const request = backend.expectOne(`${API}/api/v1/organization`);
    expect(request.request.headers.get('X-Organization-Id')).toBe('org-1');
    request.flush({
      id: 'org-1',
      name: 'Barbería',
      plan: 'max',
      planActiveUntil: '2026-11-06T05:00:00Z',
    });

    expect((await call).plan).toBe('max');
  });

  it('lists the visible establishments, keeping the archive date', async () => {
    const call = firstValueFrom(TestBed.inject(EstablishmentsApi).listVisible());

    const request = backend.expectOne(`${API}/api/v1/establishments`);
    expect(request.request.headers.get('X-Organization-Id')).toBe('org-1');
    request.flush([
      establishmentResource('est-1'),
      establishmentResource('est-2', '2026-10-01T00:00:00Z'),
    ]);

    const [open, archived] = await call;
    expect(open).toMatchObject({ timeZone: 'America/Lima', archivedAt: null, archived: false });
    expect(archived.archived).toBe(true);
  });

  it('accepts an invitation with its token and no idempotency key', async () => {
    const call = firstValueFrom(TestBed.inject(InvitationAcceptancesApi).accept('tok-1'));

    const request = backend.expectOne(`${API}/api/v1/invitation-acceptances`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ token: 'tok-1' });
    expect(request.request.headers.has('Idempotency-Key')).toBe(false);
    request.flush(joinedResource('org-2', 'staff'), { status: 201, statusText: '' });

    expect((await call).role).toBe('staff');
  });

  it('O1: creates an organization with a key, leaving out a blank address and time zone', async () => {
    const call = firstValueFrom(
      TestBed.inject(OrganizationsApi).create(
        {
          name: ' Barbería Don Lucho ',
          establishment: { name: 'Miraflores', address: '  ', timeZone: '' },
          ownerDisplayName: 'Luis',
        },
        'key-1',
      ),
    );

    const request = backend.expectOne(`${API}/api/v1/organizations`);
    expect(request.request.method).toBe('POST');
    expect(request.request.headers.get('Idempotency-Key')).toBe('key-1');
    expect(request.request.body).toEqual({
      name: 'Barbería Don Lucho',
      establishmentName: 'Miraflores',
      ownerDisplayName: 'Luis',
    });
    request.flush(
      {
        id: 'org-9',
        name: 'Barbería Don Lucho',
        plan: 'standard',
        planActiveUntil: '2026-11-08T00:00:00Z',
      },
      { status: 201, statusText: '' },
    );

    expect((await call).id).toBe('org-9');
  });

  it('opens an establishment with a key, and describes it with none', async () => {
    const api = TestBed.inject(EstablishmentsApi);
    const details = { name: 'Barranco', address: 'Av. Grau 10', timeZone: 'America/Lima' };

    const opened = firstValueFrom(api.open(details, 'key-2'));
    const open = backend.expectOne(`${API}/api/v1/establishments`);
    expect(open.request.method).toBe('POST');
    expect(open.request.headers.get('Idempotency-Key')).toBe('key-2');
    expect(open.request.body).toEqual(details);
    open.flush(establishmentResource('est-2'), { status: 201, statusText: '' });
    expect((await opened).id).toBe('est-2');

    const described = firstValueFrom(api.describe('est-2', details));
    const put = backend.expectOne(`${API}/api/v1/establishments/est-2`);
    expect(put.request.method).toBe('PUT');
    expect(put.request.headers.has('Idempotency-Key')).toBe(false);
    put.flush(establishmentResource('est-2'));
    await described;
  });

  it('O4: archives an establishment with an empty POST and no key', async () => {
    const call = firstValueFrom(TestBed.inject(EstablishmentsApi).archive('est-2'));

    const request = backend.expectOne(`${API}/api/v1/establishments/est-2/archivals`);
    expect(request.request.method).toBe('POST');
    expect(request.request.headers.has('Idempotency-Key')).toBe(false);
    request.flush(establishmentResource('est-2', '2026-10-25T10:00:00Z'));

    expect((await call).archived).toBe(true);
  });

  it('O8: reads and replaces the opening hours as the whole week', async () => {
    const api = TestBed.inject(EstablishmentsApi);
    const read = firstValueFrom(api.openingHours('est-1'));
    backend
      .expectOne(`${API}/api/v1/establishments/est-1/opening-hours`)
      .flush({ ranges: [{ weekday: 2, opensAt: '09:00:00', closesAt: '13:00' }] });
    expect((await read).on(2)).toEqual([{ weekday: 2, opensAt: '09:00', closesAt: '13:00' }]);

    const hours = new OpeningHours([
      { weekday: 6, opensAt: '10:00', closesAt: '14:00' },
      { weekday: 1, opensAt: '09:00', closesAt: '19:00' },
    ]);
    const replaced = firstValueFrom(api.replaceOpeningHours('est-1', hours));
    const put = backend.expectOne(`${API}/api/v1/establishments/est-1/opening-hours`);
    expect(put.request.method).toBe('PUT');
    expect(put.request.headers.has('Idempotency-Key')).toBe(false);
    expect(put.request.body).toEqual({
      ranges: [
        { weekday: 1, opensAt: '09:00', closesAt: '19:00' },
        { weekday: 6, opensAt: '10:00', closesAt: '14:00' },
      ],
    });
    put.flush(put.request.body);
    expect((await replaced).openWeekdays).toEqual([1, 6]);
  });

  it('O14, O15: creates a service with a key and updates it with none', async () => {
    const api = TestBed.inject(ServicesApi);
    const details = {
      name: 'Corte + barba',
      durationMinutes: 60,
      priceCents: 4500,
      instructions: '',
      performerIds: ['m-1'],
    };

    const created = firstValueFrom(api.create('est-1', details, 'key-3'));
    const post = backend.expectOne(`${API}/api/v1/establishments/est-1/services`);
    expect(post.request.method).toBe('POST');
    expect(post.request.headers.get('Idempotency-Key')).toBe('key-3');
    expect(post.request.body).toEqual({
      name: 'Corte + barba',
      durationMinutes: 60,
      priceCents: 4500,
      performerIds: ['m-1'],
    });
    post.flush(
      { ...serviceResource('s-9'), instructions: 'Llega 5 minutos antes' },
      { status: 201, statusText: '' },
    );
    expect((await created).instructions).toBe('Llega 5 minutos antes');

    const updated = firstValueFrom(api.update('s-9', { ...details, instructions: 'Trae tu foto' }));
    const put = backend.expectOne(`${API}/api/v1/services/s-9`);
    expect(put.request.method).toBe('PUT');
    expect(put.request.headers.has('Idempotency-Key')).toBe(false);
    expect(put.request.body.instructions).toBe('Trae tu foto');
    put.flush(serviceResource('s-9'));
    await updated;
  });

  it('O14: deactivates and activates a service with empty POSTs and no key', async () => {
    const api = TestBed.inject(ServicesApi);

    const off = firstValueFrom(api.setActive('s-1', false));
    const deactivation = backend.expectOne(`${API}/api/v1/services/s-1/deactivations`);
    expect(deactivation.request.method).toBe('POST');
    expect(deactivation.request.headers.has('Idempotency-Key')).toBe(false);
    deactivation.flush({ ...serviceResource('s-1'), active: false });
    expect((await off).active).toBe(false);

    const on = firstValueFrom(api.setActive('s-1', true));
    backend.expectOne(`${API}/api/v1/services/s-1/activations`).flush(serviceResource('s-1'));
    expect((await on).active).toBe(true);
  });

  it('O2: renames the organization with a PUT and no key', async () => {
    const call = firstValueFrom(TestBed.inject(OrganizationsApi).rename('  Barbería Don Pepe '));

    const request = backend.expectOne(`${API}/api/v1/organization`);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ name: 'Barbería Don Pepe' });
    expect(request.request.headers.has('Idempotency-Key')).toBe(false);
    request.flush({
      id: 'org-1',
      name: 'Barbería Don Pepe',
      plan: 'standard',
      planActiveUntil: '2026-11-06T05:00:00Z',
    });

    expect((await call).name).toBe('Barbería Don Pepe');
  });

  it('reads members with when they joined and when their invitation expires', async () => {
    const call = firstValueFrom(TestBed.inject(MembersApi).list());

    backend.expectOne(`${API}/api/v1/members`).flush([
      { ...memberResource('m-1'), joinedAt: '2026-09-02T15:00:00Z' },
      { ...memberResource('m-2', { status: 'pending' }), inviteExpiresAt: '2026-10-28T15:00:00Z' },
    ]);

    const [joined, invited] = await call;
    expect(joined.joinedAt).toEqual(new Date('2026-09-02T15:00:00Z'));
    expect(joined.inviteExpiresAt).toBeNull();
    expect(invited.inviteExpiresAt).toEqual(new Date('2026-10-28T15:00:00Z'));
  });

  it('O10: invites with a key, sending establishments only for staff', async () => {
    const api = TestBed.inject(MembersApi);
    const invite = {
      email: ' stefano@example.com ',
      displayName: 'Stefano ',
      bookable: false,
      establishmentIds: ['est-1'],
    };

    const staff = firstValueFrom(api.invite({ ...invite, role: 'staff' }, 'key-4'));
    const post = backend.expectOne(`${API}/api/v1/members`);
    expect(post.request.method).toBe('POST');
    expect(post.request.headers.get('Idempotency-Key')).toBe('key-4');
    expect(post.request.body).toEqual({
      email: 'stefano@example.com',
      displayName: 'Stefano',
      role: 'staff',
      bookable: false,
      establishmentIds: ['est-1'],
    });
    post.flush(memberResource('m-9', { status: 'pending' }), { status: 201, statusText: '' });
    expect((await staff).status).toBe('pending');

    const manager = firstValueFrom(api.invite({ ...invite, role: 'manager' }, 'key-5'));
    const second = backend.expectOne(`${API}/api/v1/members`);
    expect(second.request.body.establishmentIds).toEqual([]);
    second.flush(memberResource('m-10', { role: 'manager', establishmentIds: [] }));
    await manager;
  });

  it('O9, O12: updates and removes a member with no key', async () => {
    const api = TestBed.inject(MembersApi);

    const updated = firstValueFrom(
      api.update('m-1', {
        displayName: 'Ana',
        bookable: true,
        role: 'manager',
        establishmentIds: ['est-1'],
      }),
    );
    const put = backend.expectOne(`${API}/api/v1/members/m-1`);
    expect(put.request.method).toBe('PUT');
    expect(put.request.headers.has('Idempotency-Key')).toBe(false);
    expect(put.request.body).toEqual({
      displayName: 'Ana',
      bookable: true,
      role: 'manager',
      establishmentIds: [],
    });
    put.flush(memberResource('m-1', { role: 'manager', establishmentIds: [] }));
    expect((await updated).role).toBe('manager');

    const removed = firstValueFrom(api.remove('m-1'), { defaultValue: undefined });
    const remove = backend.expectOne(`${API}/api/v1/members/m-1`);
    expect(remove.request.method).toBe('DELETE');
    expect(remove.request.headers.has('Idempotency-Key')).toBe(false);
    remove.flush(null, { status: 204, statusText: '' });
    await removed;
  });

  it('O10: sends an invitation again with a key', async () => {
    const call = firstValueFrom(TestBed.inject(MembersApi).renewInvitation('m-2', 'key-6'));

    const request = backend.expectOne(`${API}/api/v1/members/m-2/invitation-renewals`);
    expect(request.request.method).toBe('POST');
    expect(request.request.headers.get('Idempotency-Key')).toBe('key-6');
    request.flush({
      ...memberResource('m-2', { status: 'pending' }),
      inviteExpiresAt: '2026-11-02T15:00:00Z',
    });

    expect((await call).inviteExpiresAt).toEqual(new Date('2026-11-02T15:00:00Z'));
  });

  it('O12: transfers ownership with a key and the new owner only', async () => {
    const call = firstValueFrom(TestBed.inject(OwnershipTransfersApi).transfer('m-3', 'key-7'));

    const request = backend.expectOne(`${API}/api/v1/ownership-transfers`);
    expect(request.request.method).toBe('POST');
    expect(request.request.headers.get('Idempotency-Key')).toBe('key-7');
    expect(request.request.body).toEqual({ newOwnerId: 'm-3' });
    request.flush(memberResource('m-3', { role: 'owner', establishmentIds: [] }), {
      status: 201,
      statusText: '',
    });

    expect((await call).role).toBe('owner');
  });
});
