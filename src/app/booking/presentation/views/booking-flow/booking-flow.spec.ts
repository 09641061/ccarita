import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { appointment } from '../../../../../testing/booking-fixtures';
import { fakeResource } from '../../../../../testing/fake-resource';
import { provideSpanish } from '../../../../../testing/provide-spanish';
import { settle } from '../../../../../testing/settle';
import {
  Customer,
  CustomerDirectory,
  CustomerSearch,
  KnownCustomer,
} from '../../../../customers/public-api';
import {
  CurrentEstablishment,
  CurrentOrganization,
  EstablishmentTeam,
  Member,
  OpeningHours,
  OpeningHoursStore,
  Service,
} from '../../../../organization/public-api';
import { ApiError } from '../../../../shared/domain/model/api-error';
import { LocalDate } from '../../../../shared/domain/model/local-date';
import { Money } from '../../../../shared/domain/model/money';
import { BookingStore } from '../../../application/booking.store';
import { Appointment } from '../../../domain/model/appointment';
import { Slot } from '../../../domain/model/slot';
import { BookingFlow } from './booking-flow';

const FRIDAY = LocalDate.parse('2026-10-23');
const ROSA = new Customer('c-1', '+51987654321', 'Rosa Huamán');
const CUT = new Service('s-1', 'est-1', 'Corte clásico', 45, new Money(3500, 'PEN'), true, ['m-1']);
const LUIS = new Member('m-1', 'luis@example.com', 'Luis', 'owner', true, 'active', []);
const JOEL = new Member('m-2', 'joel@example.com', 'Joel', 'staff', true, 'active', ['est-1']);
const slotAt = (start: string, free = ['m-1', 'm-2']) =>
  new Slot(new Date(start), new Date(new Date(start).getTime() + 45 * 60_000), free);
const ELEVEN_45 = slotAt('2026-10-23T16:45:00Z');

function fakeStore() {
  const service = signal<Service | null>(null);
  const customer = signal<Customer | null>(null);
  const slot = signal<Slot | null>(null);
  const memberId = signal<string | null>(null);
  const isRescheduling = signal(false);
  const original = signal<Appointment | null>(null);
  return {
    timeZone: signal('America/Lima'),
    isRescheduling,
    original,
    rescheduling: fakeResource<Appointment>(undefined),
    services: signal([CUT]),
    service,
    customer,
    today: signal(FRIDAY),
    day: signal(FRIDAY),
    slots: fakeResource<Slot[]>([ELEVEN_45]),
    visibleSlots: signal([ELEVEN_45]),
    performers: signal([LUIS, JOEL]),
    memberId,
    slot,
    slotEnd: () => slot()?.end ?? null,
    bookCommand: () =>
      customer() && service() && slot()
        ? {
            customerId: customer()!.id,
            serviceId: 's-1',
            staffMemberId: memberId(),
            start: slot()!.start,
          }
        : null,
    rescheduleCommand: () => (slot() ? { start: slot()!.start, staffMemberId: memberId() } : null),
    colorIndex: () => 0,
    start: vi.fn((id: string | null) => isRescheduling.set(id !== null)),
    chooseCustomer: vi.fn((c: Customer) => customer.set(c)),
    chooseService: vi.fn((id: string) => service.set(id === 's-1' ? CUT : null)),
    chooseDay: vi.fn(),
    chooseSlot: vi.fn((s: Slot) => slot.set(s)),
    chooseMember: vi.fn((id: string | null) => memberId.set(id)),
    book: vi.fn(),
    reschedule: vi.fn(),
  };
}

describe('BookingFlow', () => {
  let store: ReturnType<typeof fakeStore>;
  const planActive = signal(true);
  const known = signal<ReadonlyMap<string, KnownCustomer>>(new Map());
  const want = vi.fn();

  async function render(url = '/agenda/reservar') {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-10-23T14:00:00Z') });
    store = fakeStore();
    TestBed.configureTestingModule({
      providers: [
        provideSpanish(),
        provideRouter(
          [
            { path: 'agenda/reservar', component: BookingFlow },
            { path: '**', children: [] },
          ],
          withComponentInputBinding(),
        ),
        { provide: BookingStore, useValue: store },
        { provide: CustomerDirectory, useValue: { customers: known, want } },
        { provide: CurrentOrganization, useValue: { planActive } },
        { provide: CurrentEstablishment, useValue: { timeZone: signal('America/Lima') } },
        {
          provide: OpeningHoursStore,
          useValue: {
            hours: fakeResource(
              new OpeningHours(
                ([1, 2, 3, 4, 5, 6] as const).map((weekday) => ({
                  weekday,
                  opensAt: '09:00',
                  closesAt: '19:00',
                })),
              ),
            ),
          },
        },
        {
          provide: EstablishmentTeam,
          useValue: {
            services: fakeResource([CUT]),
            membersById: signal(
              new Map([
                [LUIS.id, LUIS],
                [JOEL.id, JOEL],
              ]),
            ),
          },
        },
        {
          provide: CustomerSearch,
          useValue: {
            query: signal(''),
            results: fakeResource({ items: [ROSA], page: 0, hasMore: false }),
            search: vi.fn(),
            register: vi.fn(),
          },
        },
      ],
    });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url);
    await harness.fixture.whenStable();
    const host = harness.routeNativeElement as HTMLElement;
    const stable = () => harness.fixture.whenStable();
    return { harness, host, stable };
  }

  const text = (host: HTMLElement) => host.textContent!.replace(/\s+/g, ' ');
  const buttonWith = (host: HTMLElement, label: string) =>
    [...host.querySelectorAll<HTMLButtonElement>('button')].find((b) =>
      b.textContent!.replace(/\s+/g, ' ').includes(label),
    )!;
  const confirmButton = (host: HTMLElement) =>
    host.querySelector<HTMLButtonElement>('footer app-busy-button button')!;

  async function reachTime(host: HTMLElement, stable: () => Promise<void>) {
    buttonWith(host, 'Rosa Huamán').click();
    await stable();
    buttonWith(host, 'Corte clásico').click();
    await stable();
  }

  beforeEach(() => {
    planActive.set(true);
    known.set(new Map());
    want.mockClear();
  });
  afterEach(() => vi.useRealTimers());

  it('goes from the customer to the service to the time', async () => {
    const { host, stable } = await render();
    expect(store.start).toHaveBeenCalledWith(null);
    expect(text(host)).toContain('Paso 1 de 3 · Cliente');

    buttonWith(host, 'Rosa Huamán').click();
    await stable();
    expect(store.chooseCustomer).toHaveBeenCalledWith(ROSA);
    expect(text(host)).toContain('Paso 2 de 3 · Servicio');
    expect(text(host)).toContain('45 min');
    expect(text(host)).toContain('S/ 35.00');

    buttonWith(host, 'Corte clásico').click();
    await stable();
    expect(text(host)).toContain('Paso 3 de 3 · Fecha y hora');
    expect(text(host)).toContain('octubre de 2026');
    expect(text(host)).toContain('2 libres');
    expect(text(host)).toContain('Cualquiera');
    expect(confirmButton(host).disabled).toBe(true);
    expect(confirmButton(host).textContent).toContain('Elige una hora');
  });

  it('books the chosen time and opens the new appointment', async () => {
    const { host, stable, harness } = await render();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate');
    await reachTime(host, stable);
    buttonWith(host, '11:45').click();
    await stable();
    expect(confirmButton(host).textContent).toContain('Reservar · hoy 11:45 – 12:30');

    store.book.mockResolvedValue(appointment('confirmed', { id: 'a-9' }));
    confirmButton(host).click();
    await settle();
    await harness.fixture.whenStable();
    expect(store.book).toHaveBeenCalledWith(expect.any(String));
    expect(navigate).toHaveBeenCalledWith(['/agenda/citas', 'a-9']);
  });

  it('retries a lost answer with the same key, and a changed booking with a new one', async () => {
    const { host, stable } = await render();
    await reachTime(host, stable);
    buttonWith(host, '11:45').click();
    await stable();

    store.book.mockRejectedValueOnce(new ApiError(0, 'NETWORK_ERROR', 'x'));
    confirmButton(host).click();
    await settle();
    await stable();
    expect(text(host)).toContain('Reintentar');
    store.book.mockRejectedValueOnce(new ApiError(0, 'NETWORK_ERROR', 'x'));
    buttonWith(host, 'Reintentar').click();
    await settle();
    await stable();
    const [first, retry] = store.book.mock.calls.map(([key]) => key);
    expect(retry).toBe(first);

    buttonWith(host, 'Luis').click();
    await stable();
    store.book.mockRejectedValueOnce(new ApiError(0, 'NETWORK_ERROR', 'x'));
    confirmButton(host).click();
    await settle();
    expect(store.book.mock.calls[2][0]).not.toBe(first);
  });

  it('explains a taken time and offers no retry', async () => {
    const { host, stable } = await render();
    await reachTime(host, stable);
    buttonWith(host, '11:45').click();
    await stable();
    store.book.mockRejectedValueOnce(new ApiError(409, 'SLOT_UNAVAILABLE', 'x'));
    confirmButton(host).click();
    await settle();
    await stable();
    expect(host.querySelector('footer [role="alert"]')!.textContent).toContain(
      'Ese horario ya no está disponible.',
    );
    expect(buttonWith(host, 'Reintentar')).toBeUndefined();
  });

  it('disables members who are busy at the chosen time', async () => {
    const { host, stable } = await render();
    await reachTime(host, stable);
    store.chooseSlot(slotAt('2026-10-23T16:30:00Z', ['m-1']));
    await stable();
    const joel = buttonWith(host, 'Joel');
    expect(joel.disabled).toBe(true);
    expect(joel.textContent).toContain('Ocupado a esa hora');
  });

  it('says when a day has no free time', async () => {
    const { host, stable } = await render();
    await reachTime(host, stable);
    store.visibleSlots.set([]);
    await stable();
    expect(text(host)).toContain('No hay horarios libres este día');
  });

  it('O8: marks the days the establishment is closed', async () => {
    const { host, stable } = await render();
    await reachTime(host, stable);
    const closed = [...host.querySelectorAll<HTMLButtonElement>('.strip .day.closed')];
    expect(closed.map((day) => day.getAttribute('aria-label'))).toEqual([
      'domingo, 25 de octubre · Cerrado',
    ]);
  });

  it('points to the settings when there are no services', async () => {
    const { host, stable } = await render();
    store.services.set([]);
    buttonWith(host, 'Rosa Huamán').click();
    await stable();
    expect(text(host)).toContain('Aún no hay servicios para reservar');
  });

  it('blocks booking while the plan is inactive (O6)', async () => {
    planActive.set(false);
    const { host } = await render();
    expect(text(host)).toContain('Reservar y reprogramar vuelven cuando renueves el plan');
    expect(host.querySelector('app-customer-step')).toBeNull();
    expect(host.querySelector('footer')).toBeNull();
  });

  describe('rescheduling', () => {
    it('keeps the service and customer and starts at the time', async () => {
      const { host, stable } = await render('/agenda/reservar?reprogramar=a-1');
      expect(store.start).toHaveBeenCalledWith('a-1');
      store.original.set(appointment('confirmed', { id: 'a-1', staffMemberId: 'm-1' }));
      store.service.set(CUT);
      store.customer.set(ROSA);
      await stable();

      expect(text(host)).toContain('Reprogramar cita');
      expect(text(host)).not.toContain('Paso');
      expect(buttonWith(host, 'Cambiar')).toBeUndefined();
      expect(text(host)).toContain('Mantener a Luis');
      expect(buttonWith(host, 'Joel')).toBeDefined();

      buttonWith(host, '11:45').click();
      await stable();
      expect(confirmButton(host).textContent).toContain('Reprogramar · hoy 11:45 – 12:30');
      store.reschedule.mockResolvedValue(appointment('confirmed', { id: 'a-1' }));
      confirmButton(host).click();
      await settle();
      expect(store.reschedule).toHaveBeenCalledWith(expect.any(String));
    });

    it('refuses an appointment that is no longer confirmed (B13)', async () => {
      const { host, stable } = await render('/agenda/reservar?reprogramar=a-1');
      store.original.set(appointment('completed', { id: 'a-1' }));
      await stable();
      expect(text(host)).toContain('Solo se reprograman las citas confirmadas');
      expect(host.querySelector('footer')).toBeNull();
    });

    it('shows a missing appointment', async () => {
      const { host, stable } = await render('/agenda/reservar?reprogramar=a-1');
      store.rescheduling.error.set(new ApiError(404, 'APPOINTMENT_NOT_FOUND', 'x'));
      await stable();
      expect(text(host)).toContain('No encontramos esta cita');
    });
  });

  describe('from a customer', () => {
    it('starts with the customer chosen once known', async () => {
      const { host, stable } = await render('/agenda/reservar?cliente=c-1');
      expect(want).toHaveBeenCalledWith(['c-1']);
      expect(text(host)).toContain('Paso 1 de 3 · Cliente');

      known.set(new Map([['c-1', ROSA]]));
      await stable();
      expect(store.chooseCustomer).toHaveBeenCalledWith(ROSA);
      expect(text(host)).toContain('Paso 2 de 3 · Servicio');
    });

    it('asks for a customer when that one was deleted (C5)', async () => {
      const { host, stable } = await render('/agenda/reservar?cliente=c-1');
      known.set(new Map([['c-1', 'deleted']]));
      await stable();
      expect(store.chooseCustomer).not.toHaveBeenCalled();
      expect(text(host)).toContain('Paso 1 de 3 · Cliente');
    });
  });
});
