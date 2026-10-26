import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideSpanish } from '../../../../../testing/provide-spanish';
import { CurrentEstablishment } from '../../../application/current-establishment.store';
import { CurrentOrganization } from '../../../application/current-organization.store';
import { Establishment } from '../../../domain/model/establishment';
import { MemberAction, MemberRole, canPerform } from '../../../domain/model/member-role';
import { Settings } from './settings';

const MIRAFLORES = new Establishment('est-1', 'Miraflores', '', 'America/Lima', null);

describe('Settings', () => {
  async function render(
    role: MemberRole,
    options: { planActive?: boolean; selected?: Establishment | null } = {},
  ) {
    TestBed.configureTestingModule({
      providers: [
        provideSpanish(),
        provideRouter([
          {
            path: 'ajustes',
            component: Settings,
            children: [{ path: '**', children: [] }],
          },
        ]),
        {
          provide: CurrentOrganization,
          useValue: {
            can: (action: MemberAction) => canPerform(role, action),
            planActive: signal(options.planActive ?? true),
          },
        },
        {
          provide: CurrentEstablishment,
          useValue: {
            selected: signal(options.selected === undefined ? MIRAFLORES : options.selected),
            list: { isLoading: signal(false) },
          },
        },
      ],
    });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/ajustes/horario');
    await harness.fixture.whenStable();
    return harness.routeNativeElement as HTMLElement;
  }

  const tabs = (host: HTMLElement) =>
    [...host.querySelectorAll('[mat-tab-link]')].map((tab) => tab.textContent!.trim());
  const text = (host: HTMLElement) => host.textContent!.replace(/\s+/g, ' ');

  it('03 §5: shows the owner every section of the establishment', async () => {
    const host = await render('owner');
    expect(text(host)).toContain('Ajustes · Miraflores');
    expect(host.querySelector('h1')!.textContent).toContain('Horario');
    expect(tabs(host)).toEqual(['Datos', 'Horario', 'Servicios', 'WhatsApp', 'Asistente', 'Uso']);
  });

  it('03 §5: shows managers the hours, services, assistant and usage', async () => {
    expect(tabs(await render('manager'))).toEqual(['Horario', 'Servicios', 'Asistente', 'Uso']);
  });

  it('O6: says changes wait for the renewal while the plan is inactive', async () => {
    const host = await render('owner', { planActive: false });
    expect(text(host)).toContain('cambiarlos vuelve cuando renueves');
  });

  it('explains an organization without establishments', async () => {
    const host = await render('owner', { selected: null });
    expect(text(host)).toContain('Aún no hay locales');
    expect(tabs(host)).toEqual([]);
  });
});
