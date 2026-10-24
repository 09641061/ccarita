import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { memberResource, serviceResource } from '../../../testing/organization-fixtures';
import { settle } from '../../../testing/settle';
import { API_BASE_URL } from '../../shared/infrastructure/http/api-base-url';
import { CurrentEstablishment } from './current-establishment.store';
import { CurrentOrganization } from './current-organization.store';
import { EstablishmentTeam } from './establishment-team.store';

const API = 'http://api.test';

describe('EstablishmentTeam', () => {
  let backend: HttpTestingController;
  let team: EstablishmentTeam;
  const establishmentId = signal<string | null>('est-1');

  beforeEach(() => {
    establishmentId.set('est-1');
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
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
});
