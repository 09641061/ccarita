import { Provider } from '@angular/core';
import { Routes } from '@angular/router';
import { authGuard } from '../../iam/public-api';
import { SettingsScreens } from './settings-screens';

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
 * Primeros pasos (`/primeros-pasos`), outside the signed-in frame: creating the organization, then the owner's
 * steps, each the same screen the settings center shows. `providers` give `ESTABLISHMENT_LINE` and
 * `ESTABLISHMENT_ASSISTANT` from the contexts that own them.
 */
export function onboardingRoutes(
  { whatsapp, assistant }: Pick<SettingsScreens, 'whatsapp' | 'assistant'>,
  providers: Provider[],
): Routes {
  return [
    {
      path: 'primeros-pasos',
      canActivate: [authGuard],
      providers,
      loadComponent: () => import('./views/onboarding/onboarding').then((m) => m.Onboarding),
      title: 'Primeros pasos · Takodu',
      children: [
        { path: 'horario', loadComponent: openingHours },
        { path: 'servicios', loadComponent: services },
        { path: 'whatsapp', loadComponent: whatsapp },
        { path: 'asistente', loadComponent: assistant },
      ],
    },
  ];
}

/** Equipo (`/equipo`), for owners and managers; the app's routes guard the role. */
export const teamRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./views/team/team').then((m) => m.Team),
    title: 'Equipo · Takodu',
  },
];
