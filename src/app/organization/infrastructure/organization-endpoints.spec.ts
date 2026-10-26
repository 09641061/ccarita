import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import {
  establishmentResource,
  joinedResource,
  serviceResource,
} from '../../../testing/organization-fixtures';
import { API_BASE_URL } from '../../shared/infrastructure/http/api-base-url';
import { idempotencyInterceptor } from '../../shared/infrastructure/http/idempotency';
import { TenantContext } from '../../shared/infrastructure/tenancy/tenant-context';
import { tenantInterceptor } from '../../shared/infrastructure/tenancy/tenant.interceptor';
import { OpeningHours } from '../domain/model/opening-hours';
import { EstablishmentsApi } from './establishments.api';
import { InvitationAcceptancesApi } from './invitation-acceptances.api';
import { OrganizationsApi } from './organizations.api';
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
});
