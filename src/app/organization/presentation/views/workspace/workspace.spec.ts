import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideSpanish } from '../../../../../testing/provide-spanish';
import { settle } from '../../../../../testing/settle';
import { Subject } from 'rxjs';
import { PLATFORM_ENTRY, SessionStore, SessionUser } from '../../../../iam/public-api';
import { CurrentEstablishment } from '../../../application/current-establishment.store';
import { CurrentOrganization } from '../../../application/current-organization.store';
import { Establishment } from '../../../domain/model/establishment';
import { JoinedOrganization } from '../../../domain/model/joined-organization';
import { MemberRole } from '../../../domain/model/member-role';
import { SettingsCenter } from '../settings-center/settings-center';
import { Workspace } from './workspace';

const until = new Date('2026-11-06T05:00:00Z');
const miraflores = new Establishment('est-1', 'Miraflores', '', 'America/Lima', null);
const barranco = new Establishment('est-2', 'Barranco', '', 'America/Lima', null);

describe('Workspace', () => {
  const signedIn = signal(true);
  const signedOut = signal(false);
  let signOut: ReturnType<typeof vi.fn>;
  let select: ReturnType<typeof vi.fn>;
  let openDialog: ReturnType<typeof vi.fn>;
  let closeDialog: ReturnType<typeof vi.fn>;
  let closed: Subject<void>;

  async function render(
    role: MemberRole,
    { planActive = true, organizations = 1, operator = false } = {},
  ) {
    signedIn.set(true);
    signedOut.set(false);
    signOut = vi.fn(async () => {
      signedOut.set(true);
      signedIn.set(false);
    });
    select = vi.fn();
    closed = new Subject<void>();
    closeDialog = vi.fn();
    openDialog = vi.fn(() => ({ afterClosed: () => closed, close: closeDialog }));
    const joined = new JoinedOrganization('org-1', 'Barbería Don Lucho', until, 'm-1', role);
    TestBed.configureTestingModule({
      providers: [
        provideSpanish(),
        provideRouter([
          {
            path: '',
            component: Workspace,
            children: [{ path: '**', children: [] }],
          },
          { path: 'ingresar', children: [] },
        ]),
        {
          provide: SessionStore,
          useValue: {
            isSignedIn: signedIn,
            signedOut,
            user: signal(new SessionUser('u-1', 'luis@donlucho.pe', 'Luis Ramírez')),
            signOut,
          },
        },
        {
          provide: CurrentOrganization,
          useValue: {
            selected: signal(joined),
            role: signal(role),
            organizations: signal(Array.from({ length: organizations }, () => joined)),
            planActive: signal(planActive),
            planActiveUntil: signal(until),
            details: {
              hasValue: () => true,
              value: () => ({ id: 'org-1', plan: 'standard' }),
            },
          },
        },
        { provide: MatDialog, useValue: { open: openDialog } },
        { provide: PLATFORM_ENTRY, useValue: { visible: signal(operator) } },
        {
          provide: CurrentEstablishment,
          useValue: {
            establishments: signal([miraflores, barranco]),
            selected: signal(miraflores),
            timeZone: signal('America/Lima'),
            select,
          },
        },
      ],
    });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/agenda');
    await harness.fixture.whenStable();
    return { harness, host: harness.routeNativeElement as HTMLElement };
  }

  const drawerLinks = (host: HTMLElement) =>
    [...host.querySelectorAll('aside a[mat-list-item]')].map((a) => a.getAttribute('href'));

  const openMenu = async (harness: RouterTestingHarness, host: HTMLElement) => {
    host.querySelector<HTMLButtonElement>('aside app-profile-menu button')!.click();
    await harness.fixture.whenStable();
    return document.querySelector('.mat-mdc-menu-panel') as HTMLElement;
  };
  const menuText = (panel: HTMLElement) => panel.textContent!.replace(/\s+/g, ' ').trim();

  it('shows owners the daily destinations and the team, and no plan card', async () => {
    const { host } = await render('owner');

    expect(drawerLinks(host)).toEqual(['/agenda', '/bandeja', '/clientes', '/equipo']);
    expect(host.querySelector('app-plan-card')).toBeNull();
  });

  it('gives staff the daily destinations only', async () => {
    const { host } = await render('staff');

    expect(drawerLinks(host)).toEqual(['/agenda', '/bandeja', '/clientes']);
  });

  it('names the user and, after a dot, the plan', async () => {
    const { host } = await render('manager');

    expect(
      host.querySelector('aside app-profile-menu .text')?.textContent?.replace(/\s+/g, ' ').trim(),
    ).toBe('Luis Ramírez·Plan Standard');
  });

  it('shows the plan banner on every screen while the plan is inactive (O6)', async () => {
    const active = await render('owner');
    expect(active.host.querySelector('app-plan-banner')).toBeNull();
    TestBed.resetTestingModule();

    const { host } = await render('owner', { planActive: false });
    expect(host.querySelector('app-plan-banner')?.textContent).toContain(
      'Tu plan terminó el 6 nov',
    );
  });

  it('switches establishments from the drawer', async () => {
    const { harness, host } = await render('owner');

    host.querySelector<HTMLButtonElement>('aside app-establishment-switcher button')!.click();
    await harness.fixture.whenStable();
    const items = [...document.querySelectorAll<HTMLButtonElement>('.mat-mdc-menu-panel button')];
    items.find((item) => item.textContent?.includes('Barranco'))!.click();

    expect(select).toHaveBeenCalledWith('est-2');
  });

  it('opens a Claude-like menu: settings, placeholders and sign-out', async () => {
    const { harness, host } = await render('owner');
    const panel = await openMenu(harness, host);

    expect(menuText(panel)).toBe(
      'Luis Ramírezluis@donlucho.pesettingsAjusteshelp Ayuda Prontoworkspace_premium Subir plan Prontoschool Aprender más ProntologoutCerrar sesión',
    );
    expect(panel.querySelector('a[href="/agenda?ajustes="]')).not.toBeNull();
    const disabled = [...panel.querySelectorAll<HTMLButtonElement>('button[disabled]')];
    expect(disabled.map((b) => b.textContent!.replace(/\s+/g, ' ').trim())).toEqual([
      'help Ayuda Pronto',
      'workspace_premium Subir plan Pronto',
      'school Aprender más Pronto',
    ]);
  });

  it('offers another organization and the Takodu area only when they apply', async () => {
    const one = await render('owner');
    let panel = await openMenu(one.harness, one.host);
    expect(panel.querySelector('a[href="/organizaciones"]')).toBeNull();
    expect(panel.querySelector('a[href="/platform"]')).toBeNull();
    TestBed.resetTestingModule();

    const several = await render('owner', { organizations: 2, operator: true });
    panel = await openMenu(several.harness, several.host);
    expect(panel.querySelector('a[href="/organizaciones"]')).not.toBeNull();
    expect(panel.querySelector('a[href="/platform"]')?.textContent).toContain('Panel de Takodu');
  });

  it('signs out and goes to sign-in without a return address', async () => {
    const { harness, host } = await render('owner');
    const panel = await openMenu(harness, host);
    const exit = [...panel.querySelectorAll<HTMLButtonElement>('button')].find((item) =>
      item.textContent?.includes('Cerrar sesión'),
    )!;

    exit.click();
    await settle();
    await harness.fixture.whenStable();

    expect(signOut).toHaveBeenCalled();
    expect(TestBed.inject(Router).url).toBe('/ingresar');
  });

  it('opens the settings center from ?ajustes= over the screen, and closes it when it goes', async () => {
    const { harness } = await render('owner');
    expect(openDialog).not.toHaveBeenCalled();

    await harness.navigateByUrl('/bandeja?ajustes=horario');
    expect(openDialog).toHaveBeenCalledTimes(1);
    expect(openDialog.mock.calls[0][0]).toBe(SettingsCenter);

    await harness.navigateByUrl('/bandeja?ajustes=servicios');
    expect(openDialog).toHaveBeenCalledTimes(1);

    await harness.navigateByUrl('/bandeja');
    expect(closeDialog).toHaveBeenCalled();
  });

  it('drops ?ajustes= when the center is closed with Esc or its button', async () => {
    const { harness } = await render('owner');
    await harness.navigateByUrl('/clientes?ajustes=cuenta&q=ana');

    closed.next();
    await settle();
    await harness.fixture.whenStable();

    expect(TestBed.inject(Router).url).toBe('/clientes?q=ana');
  });

  it('returns to sign-in with the address when the session ends by itself', async () => {
    const { harness } = await render('owner');

    signedIn.set(false);
    await settle();
    await harness.fixture.whenStable();

    expect(TestBed.inject(Router).url).toBe('/ingresar?volver=%2Fagenda');
  });
});
