import { inject } from '@angular/core';
import { ResolveFn, Routes } from '@angular/router';
import { devRoutes } from './dev.routes';
import { authGuard } from './iam/public-api';
import {
  CurrentOrganization,
  organizationEntryRoutes,
  organizationGuard,
  roleGuard,
} from './organization/public-api';
import {
  MAIN_NAVIGATION,
  NavigationItem,
  navigationFor,
} from './shared/presentation/components/shell/navigation-item';

const pageNotFound = () =>
  import('./shared/presentation/views/page-not-found/page-not-found').then((m) => m.PageNotFound);
const placeholder = () =>
  import('./shared/presentation/views/placeholder/placeholder').then((m) => m.Placeholder);

/** The destinations of the signed-in member's role, for the phone's "Más". */
const roleNavigation: ResolveFn<readonly NavigationItem[]> = async () => {
  const organization = inject(CurrentOrganization);
  await organization.load();
  return navigationFor(organization.role() ?? 'staff');
};

/**
 * Sign-in, the organization picker and invitations stand alone; everything else is inside `Workspace`, behind a
 * session and a selected organization, and each destination behind the roles that see it (Mapa por rol, 03 §5).
 * Each context replaces its placeholder with one lazy entry
 * (`loadChildren: () => import('./<context>/presentation/<context>.routes')`).
 */
export const routes: Routes = [
  ...devRoutes,
  {
    path: 'ingresar',
    loadChildren: () => import('./iam/presentation/iam.routes').then((m) => m.iamRoutes),
  },
  ...organizationEntryRoutes,
  {
    path: 'primeros-pasos',
    canActivate: [authGuard],
    loadComponent: placeholder,
    data: { label: 'organization.onboarding.title' },
    title: 'Primeros pasos · Takodu',
  },
  {
    path: '',
    canActivate: [authGuard, organizationGuard],
    loadComponent: () =>
      import('./organization/presentation/views/workspace/workspace').then((m) => m.Workspace),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'agenda' },
      ...MAIN_NAVIGATION.map((item) => ({
        path: item.path.slice(1),
        canActivate: [roleGuard(item.roles)],
        loadComponent: placeholder,
        data: { label: item.label },
        title: 'Takodu',
      })),
      {
        path: 'mas',
        loadComponent: () => import('./shared/presentation/views/more/more').then((m) => m.More),
        resolve: { navigation: roleNavigation },
        title: 'Takodu',
      },
      {
        path: 'sin-permiso',
        loadComponent: () =>
          import('./shared/presentation/views/forbidden/forbidden').then((m) => m.Forbidden),
        title: 'Takodu',
      },
    ],
  },
  { path: '**', loadComponent: pageNotFound, title: 'Takodu' },
];
