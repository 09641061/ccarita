import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { appointment } from '../../../../../testing/booking-fixtures';
import { fakeResource } from '../../../../../testing/fake-resource';
import { provideSpanish } from '../../../../../testing/provide-spanish';
import { settle } from '../../../../../testing/settle';
import { Customer, CustomerDirectory } from '../../../../customers/public-api';
import {
  CurrentOrganization,
  EstablishmentTeam,
  Member,
} from '../../../../organization/public-api';
import { ApiError } from '../../../../shared/domain/model/api-error';
import { CalendarStore } from '../../../application/calendar.store';
import { Appointment } from '../../../domain/model/appointment';
import { AppointmentDetail } from './appointment-detail';

const luis = new Member('m-1', 'luis@example.com', 'Luis', 'owner', true, 'active', []);

describe('AppointmentDetail', () => {
  let opened: ReturnType<typeof fakeResource<Appointment | null>>;
  let changeStatus: ReturnType<typeof vi.fn>;
  let open: ReturnType<typeof vi.fn>;
  let sheet: { open: ReturnType<typeof vi.fn> };
  const planActive = signal(true);

  async function render(shown: Appointment | null, { now = '2026-10-23T16:00:00Z' } = {}) {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date(now) });
    opened = fakeResource<Appointment | null>(shown);
    changeStatus = vi.fn();
    open = vi.fn();
    sheet = { open: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        provideSpanish(),
        provideRouter(
          [
            { path: 'agenda/citas/:appointmentId', component: AppointmentDetail },
            { path: '**', children: [] },
          ],
          withComponentInputBinding(),
        ),
        { provide: MatDialog, useValue: sheet },
        {
          provide: CalendarStore,
          useValue: {
            timeZone: signal('America/Lima'),
            opened,
            open,
            changeStatus,
            conflicts: signal(new Map()),
          },
        },
        { provide: CurrentOrganization, useValue: { planActive } },
        {
          provide: EstablishmentTeam,
          useValue: {
            membersById: signal(new Map([[luis.id, luis]])),
            servicesById: signal(new Map()),
          },
        },
        {
          provide: CustomerDirectory,
          useValue: {
            customers: signal(
              new Map([['c-1', new Customer('c-1', '+51987654321', 'Rosa Huamán')]]),
            ),
          },
        },
      ],
    });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/agenda/citas/a-1');
    await harness.fixture.whenStable();
    return { harness, host: harness.routeNativeElement as HTMLElement };
  }

  const buttons = (host: HTMLElement) => [
    ...host.querySelectorAll<HTMLButtonElement | HTMLAnchorElement>('.actions button, .actions a'),
  ];
  const button = (host: HTMLElement, text: string) =>
    buttons(host).find((b) => b.textContent?.includes(text))!;

  beforeEach(() => planActive.set(true));
  afterEach(() => vi.useRealTimers());

  it('opens the appointment of the route and shows who, what and when', async () => {
    const { host } = await render(appointment('confirmed', { source: 'assistant' }));

    expect(open).toHaveBeenCalledWith('a-1');
    expect(host.querySelector('h1')?.textContent).toContain('Rosa Huamán');
    expect(host.querySelector('a.phone')?.getAttribute('href')).toBe('tel:+51987654321');
    expect(host.textContent?.replace(/\s+/g, ' ')).toContain('Hoy · 12:00 – 12:45');
    expect(host.textContent).toContain('Con Luis');
    expect(host.textContent).toContain('Reservada por el asistente');
  });

  it('B10, B11: offers start, complete and cancel; no-show waits for the start time', async () => {
    const { host } = await render(appointment('confirmed'));

    expect(buttons(host).map((b) => b.textContent?.replace(/\s+/g, ' ').trim())).toEqual([
      'play_arrow Iniciar',
      'check_circle Completar',
      'person_off No asistió',
      'event_repeat Reprogramar',
      'close Cancelar cita',
    ]);
    expect((button(host, 'No asistió') as HTMLButtonElement).disabled).toBe(true);
    expect(host.textContent).toContain('Disponible desde las 12:00');
  });

  it('B10: an appointment in progress only completes or is cancelled', async () => {
    const { host } = await render(appointment('in_progress'), { now: '2026-10-23T17:10:00Z' });
    expect(buttons(host).map((b) => b.textContent?.trim().split(' ').pop())).toEqual([
      'Completar',
      'cita',
    ]);
  });

  it('retries a lost status change with the same key and starts over after other errors', async () => {
    const { harness, host } = await render(appointment('confirmed'));
    changeStatus.mockRejectedValueOnce(new ApiError(0, 'NETWORK_ERROR', 'offline'));

    button(host, 'Iniciar').click();
    await settle();
    harness.fixture.detectChanges();
    const firstKey = changeStatus.mock.calls[0][2];
    expect(host.querySelector('.error')?.textContent).toContain('Sin conexión');

    changeStatus.mockRejectedValueOnce(new ApiError(409, 'INVALID_TRANSITION', 'final'));
    host.querySelector<HTMLButtonElement>('.error button')!.click();
    await settle();
    harness.fixture.detectChanges();
    expect(changeStatus.mock.calls[1][1]).toBe('in_progress');
    expect(changeStatus.mock.calls[1][2]).toBe(firstKey);
    expect(opened.reload).toHaveBeenCalled();
    expect(host.querySelector('.error')?.textContent).toContain('no puede pasar a ese estado');

    changeStatus.mockResolvedValueOnce(appointment('in_progress'));
    button(host, 'Iniciar').click();
    await settle();
    expect(changeStatus.mock.calls[2][2]).not.toBe(firstKey);
  });

  it('opens the cancel sheet with the names it shows', async () => {
    const { host } = await render(appointment('confirmed'));
    (button(host, 'Cancelar cita') as HTMLButtonElement).click();

    expect(sheet.open.mock.calls[0][1].data).toMatchObject({
      customerName: 'Rosa Huamán',
      memberName: 'Luis',
      timeZone: 'America/Lima',
    });
  });

  it('O6: keeps finishing but not rescheduling while the plan is inactive', async () => {
    planActive.set(false);
    const { host } = await render(appointment('confirmed'));

    expect(button(host, 'Reprogramar').getAttribute('aria-disabled')).toBe('true');
    expect((button(host, 'Iniciar') as HTMLButtonElement).disabled).toBe(false);
    expect(host.textContent).toContain('Reprogramar vuelve cuando renueves el plan');
  });

  it('B12: a cancelled appointment shows who and why, and no actions', async () => {
    const cancelled = Object.assign(appointment('cancelled'), {
      cancelReason: 'Se enfermó',
      cancelledBy: 'customer',
    });
    const { host } = await render(cancelled);

    expect(host.textContent).toContain('Cancelada a pedido del cliente');
    expect(host.textContent).toContain('Motivo: Se enfermó');
    expect(host.querySelector('.actions')).toBeNull();
  });

  it('shows a missing appointment as not found', async () => {
    const { harness, host } = await render(null);
    opened.error.set(new ApiError(404, 'APPOINTMENT_NOT_FOUND', 'gone'));
    harness.fixture.detectChanges();
    await harness.fixture.whenStable();

    expect(host.querySelector('app-state-view')?.textContent).toContain('No encontramos esta cita');
  });
});
