import { BreakpointObserver } from '@angular/cdk/layout';
import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of } from 'rxjs';
import { appointment, timeBlock } from '../../../../../testing/booking-fixtures';
import { fakeResource } from '../../../../../testing/fake-resource';
import { provideSpanish } from '../../../../../testing/provide-spanish';
import { Customer, CustomerDirectory } from '../../../../customers/public-api';
import {
  CurrentEstablishment,
  CurrentOrganization,
  EstablishmentTeam,
  Member,
  Service,
} from '../../../../organization/public-api';
import { ApiError } from '../../../../shared/domain/model/api-error';
import { LocalDate } from '../../../../shared/domain/model/local-date';
import { Money } from '../../../../shared/domain/model/money';
import { CalendarStore } from '../../../application/calendar.store';
import { Appointment } from '../../../domain/model/appointment';
import { CalendarRange } from '../../../domain/model/calendar-range';
import { TimeBlock } from '../../../domain/model/time-block';
import { Calendar } from './calendar';

const LIMA = 'America/Lima';
const FRIDAY = LocalDate.parse('2026-10-23');
const luis = new Member('m-1', 'luis@example.com', 'Luis', 'owner', true, 'active', []);
const kevin = new Member('m-2', 'kevin@example.com', 'Kevin', 'staff', true, 'active', ['est-1']);
const classic = new Service('s-1', 'est-1', 'Corte clásico', 45, new Money(3500, 'PEN'), true, []);

describe('Calendar', () => {
  let appointments: ReturnType<typeof fakeResource<Appointment[]>>;
  let blocks: ReturnType<typeof fakeResource<TimeBlock[]>>;
  const planActive = signal(true);

  async function render({
    desktop = false,
    items = [] as Appointment[],
    timeBlocks = [] as TimeBlock[],
    manageable = (block: TimeBlock) => block.staffMemberId === 'm-2',
  } = {}) {
    appointments = fakeResource(items);
    blocks = fakeResource(timeBlocks);
    const memberId = signal<string | null>(null);
    TestBed.configureTestingModule({
      providers: [
        provideSpanish(),
        provideRouter([
          {
            path: 'agenda',
            component: Calendar,
            children: [{ path: 'citas/:appointmentId', children: [] }],
          },
          { path: 'agenda/reservar', children: [] },
        ]),
        {
          provide: BreakpointObserver,
          useValue: { observe: () => of({ matches: desktop, breakpoints: {} }) },
        },
        {
          provide: CalendarStore,
          useValue: {
            timeZone: signal(LIMA),
            day: signal(FRIDAY),
            range: signal(CalendarRange.of(FRIDAY, 'day', LIMA)),
            members: signal([luis, kevin]),
            memberId,
            appointments,
            timeBlocks: blocks,
            visibleAppointments: computed(() => appointments.value() ?? []),
            visibleTimeBlocks: computed(() => blocks.value() ?? []),
            conflicts: signal(new Map()),
            managesEveryone: signal(false),
            canManage: manageable,
            showDay: vi.fn(),
            showView: vi.fn(),
            step: vi.fn(),
            showToday: vi.fn(),
            showMember: vi.fn((id: string | null) => memberId.set(id)),
          },
        },
        {
          provide: CurrentOrganization,
          useValue: {
            planActive,
            selected: signal({ name: 'Barbería Don Lucho' }),
            memberId: signal('m-2'),
          },
        },
        {
          provide: CurrentEstablishment,
          useValue: {
            list: fakeResource([{ id: 'est-1' }]),
            establishments: signal([{ id: 'est-1' }]),
            selected: signal({ name: 'Miraflores' }),
          },
        },
        {
          provide: EstablishmentTeam,
          useValue: {
            membersById: signal(new Map([luis, kevin].map((m) => [m.id, m]))),
            servicesById: signal(new Map([[classic.id, classic]])),
          },
        },
        {
          provide: CustomerDirectory,
          useValue: {
            customers: signal(
              new Map<string, Customer | 'deleted'>([
                ['c-1', new Customer('c-1', '+51987654321', 'Rosa Huamán')],
                ['c-gone', 'deleted'],
              ]),
            ),
          },
        },
      ],
    });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/agenda');
    await harness.fixture.whenStable();
    return { harness, host: harness.routeNativeElement as HTMLElement };
  }

  beforeEach(() => {
    planActive.set(true);
    // Two days after the calendar's day, so the title names the day instead of "Hoy".
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-10-25T15:00:00Z') });
  });

  afterEach(() => vi.useRealTimers());

  it('lists the day with names, the assistant mark and a link to each appointment', async () => {
    const { host } = await render({
      items: [
        appointment('confirmed', { source: 'assistant' }),
        appointment('cancelled', { id: 'a-2', customerId: 'c-gone', staffMemberId: 'm-2' }),
      ],
    });

    const cards = host.querySelectorAll('app-appointment-card');
    expect(cards).toHaveLength(2);
    expect(cards[0].textContent).toContain('Rosa Huamán');
    expect(cards[0].textContent).toContain('Corte clásico · Luis');
    expect(cards[0].textContent).toContain('S/ 35.00');
    expect(cards[0].querySelector('img')?.getAttribute('alt')).toBe('Reservada por el asistente');
    expect(cards[1].textContent).toContain('Cliente eliminado');
    expect(host.querySelector('app-agenda-list a')?.getAttribute('href')).toBe('/agenda/citas/a-1');
    expect(host.querySelector('h1')?.textContent).toContain('viernes, 23 de octubre');
  });

  it('shows the empty day', async () => {
    const { host } = await render();
    expect(host.querySelector('app-state-view')?.textContent).toContain('No hay citas este día');
  });

  it('keeps what it showed offline and retries both reads', async () => {
    const { harness, host } = await render();
    appointments.error.set(new ApiError(0, 'NETWORK_ERROR', 'offline'));
    harness.fixture.detectChanges();
    await harness.fixture.whenStable();

    const state = host.querySelector('app-state-view')!;
    expect(state.textContent).toContain('No hay conexión');
    state.querySelector('button')!.click();
    expect(appointments.reload).toHaveBeenCalled();
    expect(blocks.reload).toHaveBeenCalled();
  });

  it('O6: disables booking while the plan is inactive', async () => {
    planActive.set(false);
    const { host } = await render();

    const book = host.querySelector<HTMLAnchorElement>('a.fab')!;
    expect(book.getAttribute('aria-disabled')).toBe('true');
    expect(host.textContent).toContain('Reservar vuelve cuando renueves el plan');
  });

  it('B15: offers removal only for blocks the member manages', async () => {
    const { host } = await render({
      timeBlocks: [
        timeBlock('m-2', undefined, undefined, 'b-own'),
        timeBlock('m-1', undefined, undefined, 'b-other'),
      ],
    });

    const cards = host.querySelectorAll('app-block-card');
    expect(cards).toHaveLength(2);
    const removable = [...cards].map(
      (c) => !!c.querySelector('button[aria-label="Quitar bloqueo"]'),
    );
    expect(removable).toEqual([true, false]);
  });

  it('filters by member', async () => {
    const { host } = await render();
    const chips = [...host.querySelectorAll<HTMLButtonElement>('.chip')];
    expect(chips.map((c) => c.textContent?.trim())).toEqual(['Todo el equipo', 'Luis', 'Kevin']);
    chips[2].click();
    expect(TestBed.inject(CalendarStore).showMember).toHaveBeenCalledWith('m-2');
  });

  it('draws a column per member on desktop', async () => {
    const { host } = await render({
      desktop: true,
      items: [
        appointment('confirmed'),
        appointment('in_progress', { id: 'a-2', staffMemberId: 'm-2' }),
      ],
    });

    const heads = [...host.querySelectorAll('.column-head')].map((h) =>
      h.textContent?.replace(/\s+/g, ' ').trim(),
    );
    expect(heads).toEqual(['LLuis 1 cita', 'KKevin 1 cita']);
    expect(host.querySelectorAll('app-calendar-grid a.item')).toHaveLength(2);
  });
});
