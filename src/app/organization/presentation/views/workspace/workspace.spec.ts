import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideSpanish } from '../../../../../testing/provide-spanish';
import { settle } from '../../../../../testing/settle';
import { SessionStore, SessionUser } from '../../../../iam/public-api';
import { CurrentEstablishment } from '../../../application/current-establishment.store';
import { CurrentOrganization } from '../../../application/current-organization.store';
import { Establishment } from '../../../domain/model/establishment';
import { JoinedOrganization } from '../../../domain/model/joined-organization';
import { MemberRole } from '../../../domain/model/member-role';
import { Workspace } from './workspace';

const until = new Date('2026-11-06T05:00:00Z');
const miraflores = new Establishment('est-1', 'Miraflores', '', 'America/Lima', null);
const barranco = new Establishment('est-2', 'Barranco', '', 'America/Lima', null);

describe('Workspace', () => {
  const signedIn = signal(true);
  const signedOut = signal(false);
  let signOut: ReturnType<typeof vi.fn>;
  let select: ReturnType<typeof vi.fn>;

  async function render(role: MemberRole, { planActive = true, organizations = 1 } = {}) {
    signedIn.set(true);
    signedOut.set(false);
    signOut = vi.fn(async () => {
      signedOut.set(true);
      signedIn.set(false);
    });
    select = vi.fn();
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

  it('shows the owner every destination and the plan link', async () => {
    const { host } = await render('owner');

    expect(drawerLinks(host)).toContain('/organizacion');
    expect(host.querySelector('app-plan-card a')?.getAttribute('href')).toBe('/organizacion');
    expect(host.querySelector('app-plan-card')?.textContent).toContain('Plan Standard');
    expect(host.querySelector('app-plan-card')?.textContent).toContain('Activo hasta el 6 nov');
  });

  it('hides the organization from a manager', async () => {
    const { host } = await render('manager');

    expect(drawerLinks(host)).toContain('/asistente');
    expect(drawerLinks(host)).not.toContain('/organizacion');
    expect(host.querySelector('app-plan-card a')).toBeNull();
  });

  it('hides the assistant, team and settings from staff', async () => {
    const { host } = await render('staff');

    expect(drawerLinks(host)).toEqual(['/agenda', '/bandeja', '/clientes', '/cuenta']);
  });

  it('names the user with role and organization', async () => {
    const { host } = await render('manager');

    expect(host.querySelector('aside app-account-menu')?.textContent).toContain(
      'Encargado · Barbería Don Lucho',
    );
  });

  it('shows the plan banner on every screen while the plan is inactive (O6)', async () => {
    const active = await render('owner');
    expect(active.host.querySelector('app-plan-banner')).toBeNull();
    TestBed.resetTestingModule();

    const { host } = await render('owner', { planActive: false });
    expect(host.querySelector('app-plan-banner')?.textContent).toContain(
      'Tu plan terminó el 6 nov',
    );
    expect(host.querySelector('app-plan-card')?.textContent).toContain('Terminó el 6 nov');
  });

  it('switches establishments from the drawer', async () => {
    const { harness, host } = await render('owner');

    host.querySelector<HTMLButtonElement>('aside app-establishment-switcher button')!.click();
    await harness.fixture.whenStable();
    const items = [...document.querySelectorAll<HTMLButtonElement>('.mat-mdc-menu-panel button')];
    items.find((item) => item.textContent?.includes('Barranco'))!.click();

    expect(select).toHaveBeenCalledWith('est-2');
  });

  it('offers another organization only to members of several', async () => {
    const one = await render('owner');
    one.host.querySelector<HTMLButtonElement>('aside app-account-menu button')!.click();
    await one.harness.fixture.whenStable();
    expect(document.querySelector('.mat-mdc-menu-panel a[href="/organizaciones"]')).toBeNull();
    TestBed.resetTestingModule();

    const several = await render('owner', { organizations: 2 });
    several.host.querySelector<HTMLButtonElement>('aside app-account-menu button')!.click();
    await several.harness.fixture.whenStable();
    expect(document.querySelector('.mat-mdc-menu-panel a[href="/organizaciones"]')).not.toBeNull();
  });

  it('signs out and goes to sign-in without a return address', async () => {
    const { harness, host } = await render('owner');
    host.querySelector<HTMLButtonElement>('aside app-account-menu button')!.click();
    await harness.fixture.whenStable();
    const exit = [
      ...document.querySelectorAll<HTMLButtonElement>('.mat-mdc-menu-panel button'),
    ].find((item) => item.textContent?.includes('Salir'))!;

    exit.click();
    await settle();
    await harness.fixture.whenStable();

    expect(signOut).toHaveBeenCalled();
    expect(TestBed.inject(Router).url).toBe('/ingresar');
  });

  it('returns to sign-in with the address when the session ends by itself', async () => {
    const { harness } = await render('owner');

    signedIn.set(false);
    await settle();
    await harness.fixture.whenStable();

    expect(TestBed.inject(Router).url).toBe('/ingresar?volver=%2Fagenda');
  });
});
