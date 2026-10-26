import { Routes } from '@angular/router';

/** The Takodu team's area (`/platform`): every organization, then one with its plan and usage. */
export const platformRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./views/platform-frame/platform-frame').then((m) => m.PlatformFrame),
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./views/organization-accounts/organization-accounts').then(
            (m) => m.OrganizationAccounts,
          ),
        title: 'Organizaciones · Equipo Takodu',
      },
      {
        path: ':organizationId',
        loadComponent: () =>
          import('./views/organization-account/organization-account').then(
            (m) => m.OrganizationAccountPage,
          ),
        title: 'Organización · Equipo Takodu',
      },
    ],
  },
];
