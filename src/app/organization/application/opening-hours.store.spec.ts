import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { settle } from '../../../testing/settle';
import { API_BASE_URL } from '../../shared/infrastructure/http/api-base-url';
import { OpeningHours } from '../domain/model/opening-hours';
import { CurrentEstablishment } from './current-establishment.store';
import { OpeningHoursStore } from './opening-hours.store';

const API = 'http://api.test';

describe('OpeningHoursStore', () => {
  let backend: HttpTestingController;
  let store: OpeningHoursStore;
  const establishmentId = signal<string | null>('est-1');

  beforeEach(() => {
    establishmentId.set('est-1');
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: API },
        { provide: CurrentEstablishment, useValue: { id: establishmentId } },
      ],
    });
    backend = TestBed.inject(HttpTestingController);
    store = TestBed.inject(OpeningHoursStore);
  });

  afterEach(() => backend.verify());

  it('reads the hours of the selected establishment and reloads when it changes', async () => {
    TestBed.tick();
    backend
      .expectOne(`${API}/api/v1/establishments/est-1/opening-hours`)
      .flush({ ranges: [{ weekday: 1, opensAt: '09:00', closesAt: '19:00' }] });
    await settle();
    expect(store.hours.value()?.openWeekdays).toEqual([1]);

    establishmentId.set('est-2');
    TestBed.tick();
    backend.expectOne(`${API}/api/v1/establishments/est-2/opening-hours`).flush({ ranges: [] });
    await settle();
    expect(store.hours.value()?.isSet).toBe(false);
  });

  it('O8: shows the saved week without reading it again', async () => {
    TestBed.tick();
    backend.expectOne(`${API}/api/v1/establishments/est-1/opening-hours`).flush({ ranges: [] });
    await settle();

    const week = new OpeningHours([{ weekday: 2, opensAt: '10:00', closesAt: '18:00' }]);
    const saved = store.replace('est-1', week);
    const put = backend.expectOne(`${API}/api/v1/establishments/est-1/opening-hours`);
    expect(put.request.method).toBe('PUT');
    put.flush(put.request.body);
    await saved;

    expect(store.hours.value()?.on(2)).toEqual(week.ranges);
  });
});
