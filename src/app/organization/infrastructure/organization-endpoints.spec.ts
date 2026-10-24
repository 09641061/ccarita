import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { establishmentResource, joinedResource } from '../../../testing/organization-fixtures';
import { API_BASE_URL } from '../../shared/infrastructure/http/api-base-url';
import { idempotencyInterceptor } from '../../shared/infrastructure/http/idempotency';
import { TenantContext } from '../../shared/infrastructure/tenancy/tenant-context';
import { tenantInterceptor } from '../../shared/infrastructure/tenancy/tenant.interceptor';
import { EstablishmentsApi } from './establishments.api';
import { InvitationAcceptancesApi } from './invitation-acceptances.api';
import { OrganizationsApi } from './organizations.api';

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
});
