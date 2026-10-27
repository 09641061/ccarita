import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { appointmentResource, timeBlockResource } from '../../../testing/booking-fixtures';
import { settle } from '../../../testing/settle';
import { CustomerDirectory } from '../../customers/public-api';
import {
  CurrentEstablishment,
  CurrentOrganization,
  EstablishmentTeam,
  Member,
} from '../../organization/public-api';
import { LocalDate } from '../../shared/domain/model/local-date';
import { API_BASE_URL } from '../../shared/infrastructure/http/api-base-url';
import { apiErrorInterceptor } from '../../shared/infrastructure/http/api-error.interceptor';
import { idempotencyInterceptor } from '../../shared/infrastructure/http/idempotency';
import { Subject } from 'rxjs';
import {
  APPOINTMENT_CHANGES,
  AppointmentChangeNotice,
} from '../../shared/application/appointment-changes';
import { CHANGE_DEBOUNCE_MS, CalendarStore } from './calendar.store';

const API = 'http://api.test';
const FRIDAY = LocalDate.parse('2026-10-23');

describe('CalendarStore', () => {
  let backend: HttpTestingController;
  let store: CalendarStore;
  const establishmentId = signal<string | null>('est-1');
  const want = vi.fn();
  let changes: Subject<AppointmentChangeNotice>;
  const members = signal([
    new Member('m-1', 'luis@example.com', 'Luis', 'owner', true, 'active', []),
    new Member('m-2', 'joel@example.com', 'Joel', 'staff', true, 'active', ['est-1']),
  ]);

  beforeEach(() => {
    establishmentId.set('est-1');
    want.mockReset();
    changes = new Subject();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([idempotencyInterceptor, apiErrorInterceptor])),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: API },
        {
          provide: CurrentEstablishment,
          useValue: { id: establishmentId, timeZone: signal('America/Lima') },
        },
        {
          provide: CurrentOrganization,
          useValue: { can: () => false, memberId: signal('m-2') },
        },
        { provide: EstablishmentTeam, useValue: { bookable: members } },
        { provide: CustomerDirectory, useValue: { want } },
        { provide: APPOINTMENT_CHANGES, useValue: changes },
      ],
    });
    backend = TestBed.inject(HttpTestingController);
    store = TestBed.inject(CalendarStore);
    store.showDay(FRIDAY);
  });

  afterEach(() => backend.verify());

  function expectRange(establishment: string, from: string, to: string) {
    const matches = (path: string) => (r: { url: string; params: URLSearchParamsLike }) =>
      r.url === `${API}/api/v1/establishments/${establishment}/${path}` &&
      r.params.get('from') === from &&
      r.params.get('to') === to;
    return {
      appointments: backend.expectOne((r) => matches('appointments')(r)),
      blocks: backend.expectOne((r) => matches('time-blocks')(r)),
    };
  }

  async function loadFriday(appointments: unknown[] = [], blocks: unknown[] = []) {
    TestBed.tick();
    const requests = expectRange('est-1', '2026-10-23T05:00:00.000Z', '2026-10-24T05:00:00.000Z');
    requests.appointments.flush(appointments);
    requests.blocks.flush(blocks);
    await settle();
  }

  it('reloads the appointments once after a burst of changes in its establishment', async () => {
    await loadFriday();
    vi.useFakeTimers();
    changes.next({ appointmentId: 'a-1', establishmentId: 'est-2' });
    vi.advanceTimersByTime(CHANGE_DEBOUNCE_MS);
    TestBed.tick();
    backend.expectNone((r) => r.url.endsWith('/appointments'));

    changes.next({ appointmentId: 'a-1', establishmentId: 'est-1' });
    changes.next({ appointmentId: 'a-2', establishmentId: 'est-1' });
    vi.advanceTimersByTime(CHANGE_DEBOUNCE_MS);
    vi.useRealTimers();
    TestBed.tick();
    backend
      .expectOne((r) => r.url === `${API}/api/v1/establishments/est-1/appointments`)
      .flush([appointmentResource('a-2')]);
    await settle();
    expect(store.appointments.value().map((a) => a.id)).toEqual(['a-2']);
  });

  it('reads the day in the establishment zone and asks for its customers', async () => {
    await loadFriday([appointmentResource('a-1', { customerId: 'c-7' })]);

    expect(store.visibleAppointments().map((a) => a.id)).toEqual(['a-1']);
    TestBed.tick();
    expect(want).toHaveBeenLastCalledWith(['c-7']);
  });

  it('reloads for the next day, the week and another establishment', async () => {
    await loadFriday();

    store.step(1);
    TestBed.tick();
    let requests = expectRange('est-1', '2026-10-24T05:00:00.000Z', '2026-10-25T05:00:00.000Z');
    requests.appointments.flush([]);
    requests.blocks.flush([]);

    store.showView('week');
    TestBed.tick();
    requests = expectRange('est-1', '2026-10-19T05:00:00.000Z', '2026-10-26T05:00:00.000Z');
    requests.appointments.flush([]);
    requests.blocks.flush([]);
    expect(store.range()?.days).toHaveLength(7);

    establishmentId.set('est-2');
    TestBed.tick();
    requests = expectRange('est-2', '2026-10-19T05:00:00.000Z', '2026-10-26T05:00:00.000Z');
    requests.appointments.flush([]);
    requests.blocks.flush([]);
  });

  it('filters by member, keeping blocks of the whole establishment', async () => {
    await loadFriday(
      [appointmentResource('a-1'), appointmentResource('a-2', { staffMemberId: 'm-2' })],
      [
        timeBlockResource('b-1', { staffMemberId: 'm-1' }),
        timeBlockResource('b-all', { staffMemberId: undefined }),
      ],
    );

    store.showMember('m-2');
    expect(store.visibleAppointments().map((a) => a.id)).toEqual(['a-2']);
    expect(store.visibleTimeBlocks().map((b) => b.id)).toEqual(['b-all']);
    store.showMember('m-gone');
    expect(store.memberId()).toBeNull();
  });

  it('B15: marks booked appointments that collide with a block', async () => {
    await loadFriday(
      [
        appointmentResource('a-1', { start: '2026-10-23T18:30:00Z', end: '2026-10-23T19:15:00Z' }),
        appointmentResource('a-2'),
      ],
      [timeBlockResource('b-1')],
    );

    expect([...store.conflicts().keys()]).toEqual(['a-1']);
  });

  it('B15: staff manage only their own blocks', async () => {
    await loadFriday(
      [],
      [timeBlockResource('b-own', { staffMemberId: 'm-2' }), timeBlockResource('b-1')],
    );

    const [own, other] = store.timeBlocks.value();
    expect(store.canManage(own)).toBe(true);
    expect(store.canManage(other)).toBe(false);
  });

  it('reloads the day and updates the opened appointment after a status change', async () => {
    await loadFriday([appointmentResource('a-1')]);
    store.open('a-1');
    TestBed.tick();
    backend.expectOne(`${API}/api/v1/appointments/a-1`).flush(appointmentResource('a-1'));
    await settle();

    const done = store.changeStatus(store.opened.value()!, 'in_progress', 'key-1');
    const post = backend.expectOne(`${API}/api/v1/appointments/a-1/status-changes`);
    expect(post.request.headers.get('Idempotency-Key')).toBe('key-1');
    post.flush(appointmentResource('a-1', { status: 'in_progress' }));
    await done;

    expect(store.opened.value()?.status).toBe('in_progress');
    TestBed.tick();
    backend
      .expectOne((r) => r.url === `${API}/api/v1/establishments/est-1/appointments`)
      .flush([appointmentResource('a-1', { status: 'in_progress' })]);
    backend.expectNone(`${API}/api/v1/appointments/a-1`);
  });

  it('keeps the day when a command fails and surfaces the code', async () => {
    await loadFriday([appointmentResource('a-1')]);

    const done = store.cancel(
      store.appointments.value()[0],
      { reason: 'Se enfermó', cancelledBy: 'customer' },
      'key-2',
    );
    backend
      .expectOne(`${API}/api/v1/appointments/a-1/cancellations`)
      .flush({ code: 'INVALID_TRANSITION' }, { status: 409, statusText: 'Conflict' });

    await expect(done).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });
    expect(store.appointments.value()).toHaveLength(1);
  });

  it('reloads the blocks after removing and creating one', async () => {
    await loadFriday([], [timeBlockResource('b-1', { staffMemberId: 'm-2' })]);
    const reloadBlocks = () => {
      TestBed.tick();
      backend
        .expectOne((r) => r.method === 'GET' && r.url.endsWith('/establishments/est-1/time-blocks'))
        .flush([]);
    };

    const removed = store.deleteTimeBlock(store.timeBlocks.value()[0]);
    backend
      .expectOne(`${API}/api/v1/time-blocks/b-1`)
      .flush({ code: 'TIME_BLOCK_NOT_FOUND' }, { status: 404, statusText: 'Not Found' });
    await removed;
    reloadBlocks();

    const created = store.createTimeBlock(
      {
        staffMemberId: 'm-2',
        start: new Date('2026-10-23T20:00:00Z'),
        end: new Date('2026-10-23T21:00:00Z'),
        reason: null,
      },
      'key-3',
    );
    backend
      .expectOne((r) => r.method === 'POST')
      .flush(timeBlockResource('b-2', { staffMemberId: 'm-2' }));
    await created;
    reloadBlocks();
  });
});

interface URLSearchParamsLike {
  get(name: string): string | null;
}
