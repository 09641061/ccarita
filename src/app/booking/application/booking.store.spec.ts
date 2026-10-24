import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { appointmentResource } from '../../../testing/booking-fixtures';
import { settle } from '../../../testing/settle';
import { Customer, CustomerDirectory } from '../../customers/public-api';
import {
  CurrentEstablishment,
  EstablishmentTeam,
  Member,
  Service,
} from '../../organization/public-api';
import { LocalDate } from '../../shared/domain/model/local-date';
import { Money } from '../../shared/domain/model/money';
import { API_BASE_URL } from '../../shared/infrastructure/http/api-base-url';
import { apiErrorInterceptor } from '../../shared/infrastructure/http/api-error.interceptor';
import { idempotencyInterceptor } from '../../shared/infrastructure/http/idempotency';
import { BookingStore } from './booking.store';
import { CalendarStore } from './calendar.store';

const API = 'http://api.test';
const NOW = new Date('2026-10-23T14:00:00Z'); // Friday 09:00 in Lima
const ROSA = new Customer('c-1', '+51987654321', 'Rosa Huamán');

const slot = (start: string, free: string[]) => ({
  start,
  end: new Date(new Date(start).getTime() + 45 * 60_000).toISOString(),
  freeMemberIds: free,
});

describe('BookingStore', () => {
  let backend: HttpTestingController;
  let store: BookingStore;
  const calendar = { showDay: vi.fn(), appointments: { reload: vi.fn() } };
  const customers = signal(new Map<string, Customer | 'deleted'>());
  const want = vi.fn();
  const members = [
    new Member('m-1', 'luis@example.com', 'Luis', 'owner', true, 'active', []),
    new Member('m-2', 'joel@example.com', 'Joel', 'staff', true, 'active', ['est-1']),
  ];
  const services = [
    new Service('s-1', 'est-1', 'Corte clásico', 45, new Money(3500, 'PEN'), true, ['m-1', 'm-2']),
    new Service('s-2', 'est-1', 'Tinte', 90, new Money(9000, 'PEN'), false, ['m-1']),
    new Service('s-3', 'est-1', 'Masaje', 60, new Money(6000, 'PEN'), true, ['m-9']),
  ];

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'], now: NOW });
    calendar.showDay.mockReset();
    calendar.appointments.reload.mockReset();
    want.mockReset();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([idempotencyInterceptor, apiErrorInterceptor])),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: API },
        {
          provide: CurrentEstablishment,
          useValue: { id: signal('est-1'), timeZone: signal('America/Lima') },
        },
        {
          provide: EstablishmentTeam,
          useValue: {
            bookable: signal(members),
            services: { value: signal(services) },
            servicesById: signal(new Map(services.map((s) => [s.id, s]))),
          },
        },
        { provide: CalendarStore, useValue: calendar },
        { provide: CustomerDirectory, useValue: { customers, want } },
      ],
    });
    backend = TestBed.inject(HttpTestingController);
    store = TestBed.inject(BookingStore);
    store.start(null);
  });

  afterEach(() => {
    backend.verify();
    vi.useRealTimers();
  });

  const slotsRequest = () => backend.expectOne((r) => r.url === `${API}/api/v1/services/s-1/slots`);

  async function chooseRosaAndCut() {
    store.chooseCustomer(ROSA);
    store.chooseService('s-1');
    TestBed.tick();
    const request = slotsRequest();
    request.flush([
      slot('2026-10-23T16:30:00Z', ['m-1']),
      slot('2026-10-23T16:45:00Z', ['m-1', 'm-2']),
    ]);
    await settle();
    return request;
  }

  it('offers active services someone here performs', () => {
    expect(store.services().map((s) => s.id)).toEqual(['s-1']);
  });

  it('asks for the slots of today in the establishment, for the customer', async () => {
    const request = await chooseRosaAndCut();
    expect(request.request.params.get('date')).toBe('2026-10-23');
    expect(request.request.params.get('customerId')).toBe('c-1');
    expect(store.visibleSlots()).toHaveLength(2);
  });

  it('reloads the slots when the day, service or customer change, not the member', async () => {
    await chooseRosaAndCut();
    store.chooseMember('m-2');
    TestBed.tick();
    backend.expectNone((r) => r.url.includes('/slots'));
    expect(store.visibleSlots().map((s) => s.start.toISOString())).toEqual([
      '2026-10-23T16:45:00.000Z',
    ]);

    store.chooseDay(LocalDate.parse('2026-10-24'));
    TestBed.tick();
    expect(slotsRequest().request.params.get('date')).toBe('2026-10-24');

    store.chooseCustomer(new Customer('c-2', '+51911111111', 'Piero'));
    TestBed.tick();
    expect(slotsRequest().request.params.get('customerId')).toBe('c-2');
  });

  it('forgets a chosen time the chosen member cannot take', async () => {
    await chooseRosaAndCut();
    store.chooseSlot(store.visibleSlots()[0]);
    expect(store.slot()).not.toBeNull();
    store.chooseMember('m-2');
    expect(store.slot()).toBeNull();
  });

  it('books with anyone, then shows that day in the calendar (B17)', async () => {
    await chooseRosaAndCut();
    store.chooseSlot(store.visibleSlots()[1]);
    const booked = store.book('key-1');
    const request = backend.expectOne(`${API}/api/v1/appointments`);
    expect(request.request.headers.get('Idempotency-Key')).toBe('key-1');
    expect(request.request.body).toEqual({
      customerId: 'c-1',
      serviceId: 's-1',
      start: '2026-10-23T16:45:00.000Z',
    });
    request.flush(appointmentResource('a-9', { start: '2026-10-23T16:45:00Z' }));

    expect((await booked).id).toBe('a-9');
    expect(calendar.showDay).toHaveBeenCalledWith(LocalDate.parse('2026-10-23'));
    expect(calendar.appointments.reload).toHaveBeenCalled();
  });

  it('reloads the slots when the time was taken', async () => {
    await chooseRosaAndCut();
    store.chooseSlot(store.visibleSlots()[0]);
    const booked = store.book('key-2');
    backend
      .expectOne(`${API}/api/v1/appointments`)
      .flush({ code: 'SLOT_UNAVAILABLE' }, { status: 409, statusText: 'Conflict' });
    await expect(booked).rejects.toMatchObject({ code: 'SLOT_UNAVAILABLE' });
    TestBed.tick();
    slotsRequest().flush([]);
    expect(calendar.appointments.reload).not.toHaveBeenCalled();
  });

  it('does not reload the slots when the answer was lost', async () => {
    await chooseRosaAndCut();
    store.chooseSlot(store.visibleSlots()[0]);
    const booked = store.book('key-3');
    backend.expectOne(`${API}/api/v1/appointments`).error(new ProgressEvent('error'));
    await expect(booked).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
    TestBed.tick();
    backend.expectNone((r) => r.url.includes('/slots'));
  });

  describe('rescheduling', () => {
    async function openOriginal() {
      store.start('a-1');
      TestBed.tick();
      backend
        .expectOne(`${API}/api/v1/appointments/a-1`)
        .flush(appointmentResource('a-1', { start: '2026-10-24T15:00:00Z', staffMemberId: 'm-2' }));
      await settle();
      TestBed.tick();
    }

    it('keeps the service and customer, starts on its day and leaves the customer out of slots', async () => {
      await openOriginal();
      expect(store.service()?.id).toBe('s-1');
      expect(store.customerId()).toBe('c-1');
      expect(want).toHaveBeenCalledWith(['c-1']);
      const request = slotsRequest();
      expect(request.request.params.get('date')).toBe('2026-10-24');
      expect(request.request.params.has('customerId')).toBe(false);
      request.flush([
        slot('2026-10-24T16:00:00Z', ['m-1']),
        slot('2026-10-24T16:15:00Z', ['m-1', 'm-2']),
      ]);
      await settle();
      // The kept member is free only at 11:15.
      expect(store.visibleSlots()).toHaveLength(1);
    });

    it('sends a member only when it changes (B13)', async () => {
      await openOriginal();
      slotsRequest().flush([slot('2026-10-24T16:15:00Z', ['m-1', 'm-2'])]);
      await settle();
      store.chooseSlot(store.visibleSlots()[0]);
      store.chooseMember('m-2');
      expect(store.rescheduleCommand()?.staffMemberId).toBeNull();
      store.chooseMember('m-1');
      const moved = store.reschedule('key-4');
      const request = backend.expectOne(`${API}/api/v1/appointments/a-1/reschedulings`);
      expect(request.request.body).toEqual({
        staffMemberId: 'm-1',
        start: '2026-10-24T16:15:00.000Z',
      });
      request.flush(appointmentResource('a-1', { start: '2026-10-24T16:15:00Z' }));
      expect((await moved).id).toBe('a-1');
      expect(calendar.showDay).toHaveBeenCalledWith(LocalDate.parse('2026-10-24'));
    });
  });
});
