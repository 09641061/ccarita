import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { settle } from '../../../testing/settle';
import {
  PLAN_ACTIVE_UNTIL,
  establishmentResource,
  joinedResource,
} from '../../../testing/organization-fixtures';
import { SessionStore } from '../../iam/public-api';
import { API_BASE_URL } from '../../shared/infrastructure/http/api-base-url';
import { apiErrorInterceptor } from '../../shared/infrastructure/http/api-error.interceptor';
import { TenantContext } from '../../shared/infrastructure/tenancy/tenant-context';
import { tenantInterceptor } from '../../shared/infrastructure/tenancy/tenant.interceptor';
import { CurrentEstablishment } from './current-establishment.store';
import { CurrentOrganization } from './current-organization.store';

const API = 'http://api.test';

describe('CurrentOrganization and CurrentEstablishment', () => {
  let backend: HttpTestingController;
  let store: CurrentOrganization;
  let tenant: TenantContext;
  const user = signal<{ id: string } | null>({ id: 'u-1' });

  beforeEach(() => {
    localStorage.clear();
    user.set({ id: 'u-1' });
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([tenantInterceptor, apiErrorInterceptor])),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: API },
        { provide: SessionStore, useValue: { user } },
      ],
    });
    backend = TestBed.inject(HttpTestingController);
    store = TestBed.inject(CurrentOrganization);
    tenant = TestBed.inject(TenantContext);
  });

  afterEach(() => {
    backend.match(() => true).forEach((request) => request.flush(null));
  });

  async function load(organizations: unknown[]) {
    const done = store.load();
    backend.expectOne(`${API}/api/v1/organizations`).flush(organizations);
    return done;
  }

  it('selects the only organization without asking', async () => {
    await load([joinedResource('org-1', 'manager')]);

    expect(tenant.organizationId()).toBe('org-1');
    expect(store.role()).toBe('manager');
    expect(store.can('manageTeam')).toBe(true);
    expect(store.can('connectWhatsapp')).toBe(false);
  });

  it('asks when there are several and none is selected', async () => {
    await load([joinedResource('org-1'), joinedResource('org-2', 'staff')]);

    expect(store.selected()).toBeNull();
    store.select('org-2');
    expect(store.role()).toBe('staff');
    expect(JSON.parse(localStorage.getItem('ccarita.tenant')!).organizationId).toBe('org-2');
  });

  it('drops a stored organization that is no longer a membership', async () => {
    tenant.selectOrganization('org-gone');

    await load([joinedResource('org-1'), joinedResource('org-2')]);

    expect(tenant.organizationId()).toBeNull();
  });

  it('loads once and forgets the list of a previous user', async () => {
    await load([joinedResource('org-1')]);
    await store.load();
    backend.expectNone(`${API}/api/v1/organizations`);

    user.set({ id: 'u-2' });

    expect(store.organizations()).toBeNull();
    expect(store.selected()).toBeNull();
  });

  it('reads the plan from pibble and reports it inactive after its end (O5, O6)', async () => {
    await load([joinedResource('org-1', 'owner', '2026-01-01T00:00:00Z')]);
    expect(store.planActive()).toBe(false);

    TestBed.tick();
    const details = backend.expectOne(`${API}/api/v1/organization`);
    expect(details.request.headers.get('X-Organization-Id')).toBe('org-1');
    details.flush({
      id: 'org-1',
      name: 'Negocio',
      plan: 'standard',
      planActiveUntil: '2999-01-01T00:00:00Z',
    });
    await settle();

    expect(store.planActive()).toBe(true);
    expect(store.planActiveUntil()).toEqual(new Date('2999-01-01T00:00:00Z'));
  });

  it('selects the organization of an accepted invitation', async () => {
    await load([joinedResource('org-1')]);

    const done = store.acceptInvitation('tok-1');
    backend
      .expectOne(`${API}/api/v1/invitation-acceptances`)
      .flush(joinedResource('org-2', 'staff'), { status: 201, statusText: '' });
    await settle();
    backend
      .expectOne(`${API}/api/v1/organizations`)
      .flush([joinedResource('org-1'), joinedResource('org-2', 'staff')]);
    await done;

    expect(tenant.organizationId()).toBe('org-2');
    expect(store.role()).toBe('staff');
  });

  it('shows the visible establishments without archived ones and remembers the choice', async () => {
    const establishment = TestBed.inject(CurrentEstablishment);
    await load([joinedResource('org-1')]);
    TestBed.tick();
    backend.expectOne(`${API}/api/v1/organization`).flush({
      id: 'org-1',
      name: 'Negocio',
      plan: 'standard',
      planActiveUntil: PLAN_ACTIVE_UNTIL,
    });
    backend
      .expectOne(`${API}/api/v1/establishments`)
      .flush([
        establishmentResource('est-1'),
        establishmentResource('est-old', '2026-10-01T00:00:00Z'),
        establishmentResource('est-2'),
      ]);
    await settle();

    expect(establishment.establishments().map((e) => e.id)).toEqual(['est-1', 'est-2']);
    expect(establishment.id()).toBe('est-1');
    expect(establishment.timeZone()).toBe('America/Lima');

    establishment.select('est-2');
    expect(establishment.id()).toBe('est-2');
    expect(tenant.establishmentId()).toBe('est-2');
  });

  it('falls back to the first establishment when the stored one is gone', async () => {
    tenant.selectOrganization('org-1');
    tenant.selectEstablishment('est-archived');
    const establishment = TestBed.inject(CurrentEstablishment);
    await load([joinedResource('org-1')]);
    TestBed.tick();
    backend.expectOne(`${API}/api/v1/establishments`).flush([establishmentResource('est-1')]);
    await settle();

    expect(establishment.id()).toBe('est-1');
  });

  it('O1: creates an organization with the key and selects it', async () => {
    await load([]);
    const done = store.create(
      {
        name: 'Barbería',
        establishment: { name: 'Miraflores', address: '', timeZone: '' },
        ownerDisplayName: 'Luis',
      },
      'key-1',
    );
    const post = backend.expectOne(`${API}/api/v1/organizations`);
    expect(post.request.method).toBe('POST');
    post.flush({
      id: 'org-9',
      name: 'Barbería',
      plan: 'standard',
      planActiveUntil: PLAN_ACTIVE_UNTIL,
    });
    await settle();
    backend.expectOne(`${API}/api/v1/organizations`).flush([joinedResource('org-9')]);
    await done;

    expect(tenant.organizationId()).toBe('org-9');
    expect(store.role()).toBe('owner');
  });

  it('selects an opened establishment and falls back after archiving it', async () => {
    tenant.selectOrganization('org-1');
    const establishment = TestBed.inject(CurrentEstablishment);
    await load([joinedResource('org-1')]);
    TestBed.tick();
    backend.expectOne(`${API}/api/v1/establishments`).flush([establishmentResource('est-1')]);
    await settle();

    const details = { name: 'Barranco', address: '', timeZone: '' };
    const opened = establishment.open(details, 'key-2');
    backend.expectOne(`${API}/api/v1/establishments`).flush(establishmentResource('est-2'), {
      status: 201,
      statusText: '',
    });
    await opened;
    TestBed.tick();
    backend
      .expectOne(`${API}/api/v1/establishments`)
      .flush([establishmentResource('est-1'), establishmentResource('est-2')]);
    await settle();
    expect(establishment.id()).toBe('est-2');

    const archived = establishment.archive('est-2');
    backend
      .expectOne(`${API}/api/v1/establishments/est-2/archivals`)
      .flush(establishmentResource('est-2', '2026-10-25T10:00:00Z'));
    await archived;
    TestBed.tick();
    backend.expectOne(`${API}/api/v1/establishments`).flush([establishmentResource('est-1')]);
    await settle();
    expect(establishment.id()).toBe('est-1');
  });
});
