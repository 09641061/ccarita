import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { SessionStore } from '../../../iam/public-api';
import { ApiError } from '../../../shared/domain/model/api-error';
import { MAIN_NAVIGATION } from '../../../shared/presentation/components/shell/navigation-item';
import { CurrentOrganization } from '../../application/current-organization.store';
import { MemberRole } from '../../domain/model/member-role';
import { organizationGuard } from './organization.guard';
import { roleGuard } from './role.guard';

interface Stub {
  signedIn?: boolean;
  selected?: boolean;
  role?: MemberRole | null;
  failure?: ApiError;
}

function provide({ signedIn = true, selected = true, role = 'owner', failure }: Stub) {
  TestBed.configureTestingModule({
    providers: [
      { provide: SessionStore, useValue: { restore: async () => signedIn } },
      {
        provide: CurrentOrganization,
        useValue: {
          load: async () => {
            if (failure) throw failure;
            return [];
          },
          selected: () => (selected ? { id: 'org-1' } : null),
          role: () => role,
        },
      },
    ],
  });
}

const state = { url: '/clientes' } as RouterStateSnapshot;
const route = {} as ActivatedRouteSnapshot;
const url = (result: unknown) => TestBed.inject(Router).serializeUrl(result as UrlTree);

describe('organizationGuard', () => {
  const run = () =>
    TestBed.runInInjectionContext(() => organizationGuard(route, state)) as Promise<
      boolean | UrlTree
    >;

  it('lets the user in with an organization selected', async () => {
    provide({});
    expect(await run()).toBe(true);
  });

  it('sends to the picker without a selection, keeping the address', async () => {
    provide({ selected: false });
    expect(url(await run())).toBe('/organizaciones?volver=%2Fclientes');
  });

  it('sends to the picker, which can retry, when the list cannot load', async () => {
    provide({ failure: new ApiError(0, 'NETWORK_ERROR', 'offline') });
    expect(url(await run())).toBe('/organizaciones?volver=%2Fclientes');
  });

  it('leaves a signed-out user to authGuard', async () => {
    provide({ signedIn: false, selected: false });
    expect(await run()).toBe(true);
  });
});

describe('roleGuard (Mapa por rol)', () => {
  const allowed = () =>
    Promise.all(
      MAIN_NAVIGATION.map(async (item) => {
        const result = await (TestBed.runInInjectionContext(() =>
          roleGuard(item.roles)(route, state),
        ) as Promise<boolean | UrlTree>);
        return result === true ? item.path : null;
      }),
    ).then((paths) => paths.filter((path) => path !== null));

  it('lets the owner reach every destination', async () => {
    provide({ role: 'owner' });
    expect(await allowed()).toEqual(MAIN_NAVIGATION.map((item) => item.path));
  });

  it('lets managers reach the team too', async () => {
    provide({ role: 'manager' });
    expect(await allowed()).toEqual(['/agenda', '/bandeja', '/clientes', '/equipo']);
  });

  it('keeps staff to calendar, inbox and customers', async () => {
    provide({ role: 'staff' });
    expect(await allowed()).toEqual(['/agenda', '/bandeja', '/clientes']);
  });

  it('sends a disallowed role to the no-permission screen', async () => {
    provide({ role: 'staff' });
    const result = await TestBed.runInInjectionContext(() => roleGuard(['owner'])(route, state));
    expect(url(result)).toBe('/sin-permiso');
  });
});
