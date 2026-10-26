import { BreakpointObserver } from '@angular/cdk/layout';
import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialogRef } from '@angular/material/dialog';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { fakeResource } from '../../../../../testing/fake-resource';
import { provideSpanish } from '../../../../../testing/provide-spanish';
import { settle } from '../../../../../testing/settle';
import {
  ACCOUNT_WORKSPACE,
  AccountSessionsStore,
  PLATFORM_ENTRY,
  SessionStore,
  SessionUser,
} from '../../../../iam/public-api';
import { CurrentEstablishment } from '../../../application/current-establishment.store';
import { CurrentOrganization } from '../../../application/current-organization.store';
import { Establishment } from '../../../domain/model/establishment';
import { MemberRole, canPerform } from '../../../domain/model/member-role';
import { SETTINGS_SCREENS } from '../../settings-screens';
import { SettingsCenter } from './settings-center';

@Component({
  selector: 'app-line-stub',
  template: '<p class="stub">Pantalla de la línea</p>',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class LineStub {}

const MIRAFLORES = new Establishment('est-1', 'Miraflores', '', 'America/Lima', null);

describe('SettingsCenter', () => {
  let close: ReturnType<typeof vi.fn>;

  async function render(
    role: MemberRole,
    url: string,
    { wide = true, planActive = true, establishment = MIRAFLORES as Establishment | null } = {},
  ) {
    close = vi.fn();
    const roleSignal = signal(role);
    TestBed.configureTestingModule({
      providers: [
        provideSpanish(),
        provideRouter([{ path: '**', children: [] }]),
        {
          provide: BreakpointObserver,
          useValue: { observe: () => of({ matches: wide, breakpoints: {} }) },
        },
        { provide: MatDialogRef, useValue: { close } },
        {
          provide: SETTINGS_SCREENS,
          useValue: {
            whatsapp: async () => LineStub,
            assistant: async () => LineStub,
            usage: async () => LineStub,
          },
        },
        {
          provide: CurrentOrganization,
          useValue: {
            role: roleSignal,
            can: (action: Parameters<typeof canPerform>[1]) => canPerform(roleSignal(), action),
            planActive: signal(planActive),
          },
        },
        {
          provide: CurrentEstablishment,
          useValue: {
            selected: signal(establishment),
            list: { isLoading: signal(false) },
          },
        },
        // What Cuenta, the fallback section, reads.
        {
          provide: SessionStore,
          useValue: { user: signal(new SessionUser('u-1', 'luis@donlucho.pe', 'Luis')) },
        },
        { provide: AccountSessionsStore, useValue: { sessions: fakeResource([]) } },
        {
          provide: ACCOUNT_WORKSPACE,
          useValue: { timeZone: signal('America/Lima'), canSwitchOrganization: signal(false) },
        },
        { provide: PLATFORM_ENTRY, useValue: { visible: computed(() => false) } },
      ],
    });
    await TestBed.inject(Router).navigateByUrl(url);
    const fixture = TestBed.createComponent(SettingsCenter);
    await fixture.whenStable();
    await settle();
    await fixture.whenStable();
    return { fixture, host: fixture.nativeElement as HTMLElement };
  }

  const text = (el: Element | null) => el!.textContent!.replace(/\s+/g, ' ').trim();
  const listed = (host: HTMLElement) =>
    [...host.querySelectorAll('.section-link span')].map((s) => s.textContent!.trim());

  it('03 §5: lists every section to the owner, grouped, with the establishment named', async () => {
    const { host } = await render('owner', '/agenda?ajustes=', { wide: false });

    expect([...host.querySelectorAll('.group')].map((g) => text(g))).toEqual([
      'Tu cuenta',
      'Este local · Miraflores',
      'Organización',
    ]);
    expect(listed(host)).toEqual([
      'Cuenta',
      'Datos del local',
      'Horario',
      'Servicios',
      'WhatsApp',
      'Asistente',
      'Uso del asistente',
      'Organización',
    ]);
    expect(host.querySelector('.content')).toBeNull();
  });

  it('03 §5: keeps the details, the line and the organization from managers, and all but Cuenta from staff', async () => {
    const manager = await render('manager', '/agenda?ajustes=', { wide: false });
    expect(listed(manager.host)).toEqual([
      'Cuenta',
      'Horario',
      'Servicios',
      'Asistente',
      'Uso del asistente',
    ]);
    TestBed.resetTestingModule();

    const staff = await render('staff', '/agenda?ajustes=', { wide: false });
    expect(listed(staff.host)).toEqual(['Cuenta']);
  });

  it('opens the linked section, marks it, and switches by replacing the address', async () => {
    const { fixture, host } = await render('owner', '/mensajes?ajustes=whatsapp');

    expect(text(host.querySelector('#section-title'))).toBe('WhatsApp');
    expect(text(host.querySelector('[aria-current="page"]'))).toBe('chatWhatsApp');
    expect(host.querySelector('.stub')).not.toBeNull();

    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigateByUrl');
    [...host.querySelectorAll<HTMLButtonElement>('.section-link')]
      .find((b) => b.textContent!.includes('Asistente'))!
      .click();
    await settle();
    await fixture.whenStable();
    expect(router.url).toBe('/mensajes?ajustes=asistente');
    expect(navigate.mock.calls[0][1]).toEqual({ replaceUrl: true });
  });

  it('opens the first allowed section for a value the role cannot use', async () => {
    const { fixture, host } = await render('manager', '/agenda?ajustes=organizacion');

    expect(text(host.querySelector('#section-title'))).toBe('Cuenta');
    await vi.waitFor(async () => {
      await fixture.whenStable();
      expect(host.textContent).toContain('Tus datos');
    });
  });

  it('O6: says writes are off on the establishment sections while the plan is inactive', async () => {
    const { host } = await render('owner', '/agenda?ajustes=whatsapp', { planActive: false });
    expect(host.querySelector('.body .notice')).not.toBeNull();
  });

  it('explains when there is no establishment to set up', async () => {
    const { host } = await render('owner', '/agenda?ajustes=whatsapp', { establishment: null });
    expect(host.querySelector('app-state-view')).not.toBeNull();
    expect(host.querySelector('.stub')).toBeNull();
  });

  it('on phones goes back to the list, and closes', async () => {
    const { fixture, host } = await render('owner', '/agenda?ajustes=whatsapp', { wide: false });
    expect(host.querySelector('.sections')).toBeNull();

    host.querySelector<HTMLButtonElement>('button[aria-label="Volver a la lista"]')!.click();
    await settle();
    await fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/agenda?ajustes=');
    expect(host.querySelector('.sections')).not.toBeNull();

    host.querySelector<HTMLButtonElement>('button[aria-label="Cerrar ajustes"]')!.click();
    expect(close).toHaveBeenCalled();
  });
});
