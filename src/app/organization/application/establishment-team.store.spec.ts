import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { memberResource, serviceResource } from '../../../testing/organization-fixtures';
import { settle } from '../../../testing/settle';
import { API_BASE_URL } from '../../shared/infrastructure/http/api-base-url';
import { idempotencyInterceptor } from '../../shared/infrastructure/http/idempotency';
import { CurrentEstablishment } from './current-establishment.store';
import { CurrentOrganization } from './current-organization.store';
import { EstablishmentTeam } from './establishment-team.store';
import { ServiceCatalog } from './service-catalog.store';

const API = 'http://api.test';

describe('EstablishmentTeam', () => {
  let backend: HttpTestingController;
  let team: EstablishmentTeam;
  const establishmentId = signal<string | null>('est-1');

  beforeEach(() => {
    establishmentId.set('est-1');
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([idempotencyInterceptor])),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: API },
        { provide: CurrentOrganization, useValue: { selected: signal({ id: 'org-1' }) } },
        { provide: CurrentEstablishment, useValue: { id: establishmentId } },
      ],
    });
    backend = TestBed.inject(HttpTestingController);
    team = TestBed.inject(EstablishmentTeam);
  });

  afterEach(() => backend.verify());

  async function flushTeam() {
    TestBed.tick();
    backend
      .expectOne(`${API}/api/v1/members`)
      .flush([
        memberResource('m-owner', { role: 'owner', establishmentIds: [] }),
        memberResource('m-1'),
        memberResource('m-other', { establishmentIds: ['est-2'] }),
        memberResource('m-desk', { bookable: false }),
      ]);
    backend
      .expectOne(`${API}/api/v1/establishments/est-1/services`)
      .flush([serviceResource('s-1')]);
    await settle();
  }

  it('lists who takes appointments at the establishment and its services', async () => {
    await flushTeam();

    expect(team.bookable().map((m) => m.id)).toEqual(['m-owner', 'm-1']);
    expect(team.membersById().get('m-other')?.name).toBe('Persona m-other');
    expect(team.servicesById().get('s-1')?.price.format()).toBe('S/ 35.00');
  });

  it('reloads the services when the establishment changes', async () => {
    await flushTeam();

    establishmentId.set('est-2');
    TestBed.tick();
    backend.expectOne(`${API}/api/v1/establishments/est-2/services`).flush([]);
    await settle();
    expect(team.services.value()).toEqual([]);
    expect(team.bookable().map((m) => m.id)).toEqual(['m-owner', 'm-other']);
  });

  it('O14: reloads the services after each change of the catalog', async () => {
    await flushTeam();
    const catalog = TestBed.inject(ServiceCatalog);
    const details = {
      name: 'Tinte',
      durationMinutes: 90,
      priceCents: 9000,
      instructions: '',
      performerIds: ['m-1'],
    };

    const created = catalog.create('est-1', details, 'key-1');
    const post = backend.expectOne(`${API}/api/v1/establishments/est-1/services`);
    expect(post.request.headers.get('Idempotency-Key')).toBe('key-1');
    post.flush(serviceResource('s-2'), { status: 201, statusText: '' });
    await created;
    TestBed.tick();
    backend
      .expectOne(`${API}/api/v1/establishments/est-1/services`)
      .flush([serviceResource('s-1'), serviceResource('s-2')]);
    await settle();
    expect(team.services.value().map((s) => s.id)).toEqual(['s-1', 's-2']);

    const off = catalog.setActive('s-2', false);
    backend
      .expectOne(`${API}/api/v1/services/s-2/deactivations`)
      .flush({ ...serviceResource('s-2'), active: false });
    await off;
    TestBed.tick();
    backend
      .expectOne(`${API}/api/v1/establishments/est-1/services`)
      .flush([serviceResource('s-1'), { ...serviceResource('s-2'), active: false }]);
    await settle();
    expect(team.servicesById().get('s-2')?.active).toBe(false);

    const updated = catalog.update('s-2', details);
    backend.expectOne(`${API}/api/v1/services/s-2`).flush(serviceResource('s-2'));
    await updated;
    TestBed.tick();
    backend.expectOne(`${API}/api/v1/establishments/est-1/services`).flush([]);
    await settle();
  });
});
