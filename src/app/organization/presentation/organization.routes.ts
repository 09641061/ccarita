import { Provider, inject } from '@angular/core';
import { CanActivateFn, Route, Router, Routes } from '@angular/router';
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

/** `/ajustes` opens the first section the role sees, once the role is known (route redirects run before guards). */
const firstSection: CanActivateFn = async () => {
  const organization = inject(CurrentOrganization);
  const router = inject(Router);
  await organization.load().catch(() => undefined);
  const section = organization.can('manageEstablishments') ? 'datos' : 'horario';
  return router.createUrlTree(['/ajustes', section]);
};

const openingHours = () =>
  import('./views/opening-hours-editor/opening-hours-editor').then((m) => m.OpeningHoursEditor);
const services = () => import('./views/service-list/service-list').then((m) => m.ServiceList);

/** The screens of other contexts that Ajustes and Primeros pasos mount, which `organization` does not import. */
export interface SettingsScreens {
  /** The line's screen of `conversations`. */
  readonly whatsapp: Route;
  /** The assistant's settings and usage, screens of `assistant`. */
  readonly assistant: Route;
  readonly usage: Route;
}

/** Ajustes (`/ajustes`): the sections of the selected establishment; the app's routes pass the other contexts' screens. */
export function settingsRoutes({ whatsapp, assistant, usage }: SettingsScreens): Routes {
  return [
    {
      path: '',
      loadComponent: () => import('./views/settings/settings').then((m) => m.Settings),
      children: [
        { path: '', pathMatch: 'full', canActivate: [firstSection], children: [] },
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
        { ...assistant, path: 'asistente', title: 'Asistente · Takodu' },
        { ...usage, path: 'uso', title: 'Uso del asistente · Takodu' },
      ],
    },
  ];
}

/**
 * Primeros pasos (`/primeros-pasos`), outside the signed-in frame: creating the organization, then the owner's
 * steps, each the same screen Ajustes shows. `providers` give `ESTABLISHMENT_LINE` and `ESTABLISHMENT_ASSISTANT`
 * from the contexts that own them.
 */
export function onboardingRoutes(
  { whatsapp, assistant }: Omit<SettingsScreens, 'usage'>,
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
        { ...whatsapp, path: 'whatsapp' },
        { ...assistant, path: 'asistente' },
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

/** Organización (`/organizacion`), for the owner; the app's routes guard the role. */
export const organizationPageRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./views/organization-page/organization-page').then((m) => m.OrganizationPage),
    title: 'Organización · Takodu',
  },
];
