import { Component, computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { fakeResource } from '../../../../../testing/fake-resource';
import { provideSpanish } from '../../../../../testing/provide-spanish';
import { settle } from '../../../../../testing/settle';
import { SessionStore } from '../../../../iam/public-api';
import { ApiError } from '../../../../shared/domain/model/api-error';
import { Money } from '../../../../shared/domain/model/money';
import { CurrentEstablishment } from '../../../application/current-establishment.store';
import { CurrentOrganization } from '../../../application/current-organization.store';
import {
  ESTABLISHMENT_ASSISTANT,
  ESTABLISHMENT_LINE,
} from '../../../application/establishment-line';
import { EstablishmentTeam } from '../../../application/establishment-team.store';
import { OpeningHoursStore } from '../../../application/opening-hours.store';
import { JoinedOrganization } from '../../../domain/model/joined-organization';
import { MemberRole } from '../../../domain/model/member-role';
import { OpeningHours } from '../../../domain/model/opening-hours';
import { Service } from '../../../domain/model/service';
import { Onboarding } from './onboarding';

@Component({ selector: 'app-step', template: '<p>contenido del paso</p>' })
class Step {}

const WEEK = new OpeningHours([{ weekday: 1, opensAt: '09:00', closesAt: '19:00' }]);
const CUT = new Service('s-1', 'est-1', 'Corte', 45, new Money(3500, 'PEN'), true, []);
const joined = (role: MemberRole) =>
  new JoinedOrganization(
    'org-1',
    'Barbería Don Lucho',
    new Date('2026-11-08T00:00:00Z'),
    'm-1',
    role,
  );

describe('Onboarding', () => {
  let selected: ReturnType<typeof signal<JoinedOrganization | null>>;
  let create: ReturnType<typeof vi.fn>;

  async function render(
    options: {
      organizations?: JoinedOrganization[];
      hours?: OpeningHours;
      services?: Service[];
      connected?: boolean;
      enabled?: boolean;
      url?: string;
    } = {},
  ) {
    const organizations = options.organizations ?? [];
    selected = signal(organizations[0] ?? null);
    create = vi.fn(async () => {
      selected.set(joined('owner'));
    });
    TestBed.configureTestingModule({
      providers: [
        provideSpanish(),
        provideRouter([
          {
            path: 'primeros-pasos',
            component: Onboarding,
            children: [
              { path: 'horario', component: Step },
              { path: 'servicios', component: Step },
              { path: 'whatsapp', component: Step },
              { path: 'asistente', component: Step },
            ],
          },
          { path: '**', children: [] },
        ]),
        {
          provide: SessionStore,
          useValue: { user: signal({ id: 'u-1', email: 'luis@takodu.test', name: 'Luis' }) },
        },
        {
          provide: CurrentOrganization,
          useValue: {
            load: vi.fn(async () => organizations),
            selected,
            role: computed(() => selected()?.role ?? null),
            create,
          },
        },
        { provide: CurrentEstablishment, useValue: { selected: signal(null) } },
        {
          provide: OpeningHoursStore,
          useValue: { hours: fakeResource(options.hours ?? new OpeningHours([])) },
        },
        {
          provide: EstablishmentTeam,
          useValue: { services: fakeResource(options.services ?? []) },
        },
        {
          provide: ESTABLISHMENT_LINE,
          useValue: { connected: signal(options.connected ?? false) },
        },
        {
          provide: ESTABLISHMENT_ASSISTANT,
          useValue: { enabled: signal(options.enabled ?? false) },
        },
      ],
    });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(options.url ?? '/primeros-pasos');
    const stable = async () => {
      await settle();
      await harness.fixture.whenStable();
    };
    await stable();
    return {
      host: harness.routeNativeElement as HTMLElement,
      stable,
      router: TestBed.inject(Router),
    };
  }

  const text = (host: HTMLElement) => host.textContent!.replace(/\s+/g, ' ');
  const fill = (host: HTMLElement, index: number, value: string) => {
    const input = host.querySelectorAll<HTMLInputElement>('input')[index];
    input.value = value;
    input.dispatchEvent(new Event('input'));
  };

  it('O1: a user without an organization creates one, retrying with the same key', async () => {
    const { host, stable } = await render();
    expect(text(host)).toContain('Crea tu negocio en Takodu');
    expect(host.querySelectorAll<HTMLInputElement>('input')[3].value).toBe('Luis');
    fill(host, 0, 'Barbería Don Lucho');
    fill(host, 1, 'Miraflores');
    create.mockRejectedValueOnce(new ApiError(0, 'NETWORK_ERROR', ''));
    host.querySelector('form')!.dispatchEvent(new Event('submit'));
    await stable();
    expect(text(host)).toContain('Sin conexión.');
    host.querySelector('form')!.dispatchEvent(new Event('submit'));
    await stable();

    expect(create.mock.calls[0][0]).toEqual({
      name: 'Barbería Don Lucho',
      establishment: { name: 'Miraflores', address: '', timeZone: '' },
      ownerDisplayName: 'Luis',
    });
    expect(create.mock.calls[1][1]).toBe(create.mock.calls[0][1]);
  });

  it('needs the business, the establishment and the owner’s name', async () => {
    const { host, stable } = await render();
    fill(host, 3, ' ');
    host.querySelector('form')!.dispatchEvent(new Event('submit'));
    await stable();
    expect(create).not.toHaveBeenCalled();
  });

  it('starts a fresh organization at its first step', async () => {
    const { host, router } = await render({ organizations: [joined('owner')] });
    expect(router.url).toBe('/primeros-pasos/horario');
    expect(text(host)).toContain('Barbería Don Lucho');
    expect(text(host)).toContain('0 de 4');
    expect(text(host)).toContain('Paso 1 de 4');
    expect(text(host)).toContain('Primero conecta WhatsApp');
    expect(text(host)).toContain('contenido del paso');
  });

  it('marks what pibble reports as done and goes on to the first pending step', async () => {
    const { host, stable, router } = await render({
      organizations: [joined('owner')],
      hours: WEEK,
      services: [CUT],
    });
    expect(router.url).toBe('/primeros-pasos/whatsapp');
    expect(text(host)).toContain('2 de 4');
    expect(text(host)).toContain('Días abiertos: 1');
    expect(text(host)).toContain('Servicios: 1');

    [...host.querySelectorAll('button')]
      .find((b) => b.textContent!.includes('Hacerlo después'))!
      .click();
    await stable();
    expect(router.url).toBe('/primeros-pasos/asistente');
  });

  it('A1: turning on the assistant is the last step, once WhatsApp is connected', async () => {
    const { host, stable, router } = await render({
      organizations: [joined('owner')],
      hours: WEEK,
      services: [CUT],
      connected: true,
    });
    expect(router.url).toBe('/primeros-pasos/asistente');
    expect(text(host)).toContain('Paso 4 de 4');
    expect(text(host)).toContain('Que Tako responda a tus clientes');
    expect(text(host)).not.toContain('Primero conecta WhatsApp');

    [...host.querySelectorAll('button')]
      .find((b) => b.textContent!.includes('Hacerlo después'))!
      .click();
    await stable();
    expect(router.url).toBe('/agenda');
  });

  it('says when everything is ready', async () => {
    const { host, router } = await render({
      organizations: [joined('owner')],
      hours: WEEK,
      services: [CUT],
      connected: true,
      enabled: true,
    });
    expect(router.url).toBe('/primeros-pasos');
    expect(text(host)).toContain('Todo listo');
  });

  it('leaves the setup to the owner', async () => {
    const { host } = await render({ organizations: [joined('staff')] });
    expect(text(host)).toContain('El dueño deja listo el negocio');
  });
});
