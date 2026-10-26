import { Provider, inject } from '@angular/core';
import { Route, Routes } from '@angular/router';
import { authGuard } from '../../iam/public-api';
import { CurrentOrganization } from '../application/current-organization.store';
import { roleGuard } from './guards/role.guard';

/** The organization screens outside the signed-in frame: choosing one, and accepting an invitation. */
export const organizationEntryRoutes: Routes = [
  {
    path: 'organizaciones',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./views/organization-picker/organization-picker').then((m) => m.OrganizationPicker),
    title: 'Organizaciones · Takodu',
  },
  {
    // pibble's invitation email links to APP_URL/invitations/{token}.
    path: 'invitations/:token',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./views/invitation-acceptance/invitation-acceptance').then(
        (m) => m.InvitationAcceptance,
      ),
    title: 'Invitación · Takodu',
  },
];

const openingHours = () =>
  import('./views/opening-hours-editor/opening-hours-editor').then((m) => m.OpeningHoursEditor);
const services = () => import('./views/service-list/service-list').then((m) => m.ServiceList);

/**
 * Ajustes (`/ajustes`): the sections of the selected establishment. `whatsapp` is the line's screen of
 * `conversations`, which the app's routes pass in.
 */
export function settingsRoutes(whatsapp: Route): Routes {
  return [
    {
      path: '',
      loadComponent: () => import('./views/settings/settings').then((m) => m.Settings),
      children: [
        {
          path: '',
          pathMatch: 'full',
          redirectTo: () =>
            inject(CurrentOrganization).can('manageEstablishments') ? 'datos' : 'horario',
        },
        {
          path: 'datos',
          canActivate: [roleGuard(['owner'])],
          loadComponent: () =>
            import('./views/establishment-details/establishment-details').then(
              (m) => m.EstablishmentDetails,
            ),
          title: 'Datos del local · Takodu',
        },
        { path: 'horario', loadComponent: openingHours, title: 'Horario · Takodu' },
        { path: 'servicios', loadComponent: services, title: 'Servicios · Takodu' },
        {
          ...whatsapp,
          path: 'whatsapp',
          canActivate: [roleGuard(['owner'])],
          title: 'WhatsApp · Takodu',
        },
      ],
    },
  ];
}

/**
 * Primeros pasos (`/primeros-pasos`), outside the signed-in frame: creating the organization, then the owner's
 * steps, each the same screen Ajustes shows. `line` provides `ESTABLISHMENT_LINE` from `conversations`.
 */
export function onboardingRoutes(whatsapp: Route, line: Provider): Routes {
  return [
    {
      path: 'primeros-pasos',
      canActivate: [authGuard],
      providers: [line],
      loadComponent: () => import('./views/onboarding/onboarding').then((m) => m.Onboarding),
      title: 'Primeros pasos · Takodu',
      children: [
        { path: 'horario', loadComponent: openingHours },
        { path: 'servicios', loadComponent: services },
        { ...whatsapp, path: 'whatsapp' },
      ],
    },
  ];
}
