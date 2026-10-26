import { computed, inject } from '@angular/core';
import { AssistantSettingsStore } from './assistant/public-api';
import { Route, Routes } from '@angular/router';
import { InboxStore, WhatsappLineStore } from './conversations/public-api';
import { CUSTOMER_ACCESS } from './customers/public-api';
import { devRoutes } from './dev.routes';
import { ACCOUNT_WORKSPACE, authGuard } from './iam/public-api';
import {
  CurrentEstablishment,
  CurrentOrganization,
  ESTABLISHMENT_ASSISTANT,
  ESTABLISHMENT_LINE,
  onboardingRoutes,
  organizationEntryRoutes,
  organizationGuard,
  roleGuard,
  SETTINGS_SCREENS,
  SettingsScreens,
  teamRoutes,
} from './organization/public-api';
import { operatorGuard } from './platform/public-api';
import { ApiError } from './shared/domain/model/api-error';
import { MAIN_NAVIGATION } from './shared/presentation/components/shell/navigation-item';

const pageNotFound = () =>
  import('./shared/presentation/views/page-not-found/page-not-found').then((m) => m.PageNotFound);

/** The screens of `conversations` and `assistant` inside the settings center and Primeros pasos. */
const SCREENS: SettingsScreens = {
  whatsapp: () =>
    import('./conversations/presentation/views/line-settings/line-settings').then(
      (m) => m.LineSettings,
    ),
  assistant: () =>
    import('./assistant/presentation/views/assistant-configuration/assistant-configuration').then(
      (m) => m.AssistantConfiguration,
    ),
  usage: () =>
    import('./assistant/presentation/views/usage-report/usage-report').then((m) => m.UsageReport),
};

/** Primeros pasos' WhatsApp step is done once the line is connected; a line never connected is not. */
const ESTABLISHMENT_LINE_PROVIDER = {
  provide: ESTABLISHMENT_LINE,
  useFactory: () => {
    const line = inject(WhatsappLineStore).line;
    return {
      connected: computed(() => {
        if (line.hasValue()) return line.value().connected;
        return ApiError.of(line.error() ?? null).code === 'WHATSAPP_LINE_NOT_FOUND' ? false : null;
      }),
    };
  },
};

/** Primeros pasos' assistant step is done once the assistant is on. */
const ESTABLISHMENT_ASSISTANT_PROVIDER = {
  provide: ESTABLISHMENT_ASSISTANT,
  useFactory: () => {
    const settings = inject(AssistantSettingsStore).settings;
    return { enabled: computed(() => (settings.hasValue() ? settings.value().enabled : null)) };
  },
};

/** Cuenta, in the settings center, shows times in the selected establishment's zone and offers another organization. */
const ACCOUNT_WORKSPACE_PROVIDER = {
  provide: ACCOUNT_WORKSPACE,
  useFactory: () => {
    const organization = inject(CurrentOrganization);
    return {
      timeZone: inject(CurrentEstablishment).timeZone,
      canSwitchOrganization: computed(() => (organization.organizations()?.length ?? 0) > 1),
    };
  },
};

/** Each destination's context routes. */
const CONTEXT_ROUTES: Record<string, Route> = {
  '/agenda': {
    loadChildren: () =>
      import('./booking/presentation/booking.routes').then((m) => m.bookingRoutes),
  },
  '/mensajes': {
    loadChildren: () =>
      import('./conversations/presentation/conversations.routes').then(
        (m) => m.conversationsRoutes,
      ),
  },
  '/equipo': { children: teamRoutes },
  '/clientes': {
    providers: [
      {
        provide: CUSTOMER_ACCESS,
        useFactory: () => {
          const organization = inject(CurrentOrganization);
          const inbox = inject(InboxStore);
          return {
            canDelete: computed(() => organization.can('deleteCustomers')),
            canBook: organization.planActive,
            chatOf: (customerId: string) => inbox.conversationOf(customerId),
          };
        },
      },
    ],
    loadChildren: () =>
      import('./customers/presentation/customers.routes').then((m) => m.customersRoutes),
  },
};

/**
 * Sign-in, the organization picker, invitations and the Takodu team's area (`/platform`, behind pibble's operator
 * check, with no organization) stand alone; everything else is inside `Workspace`, behind a session and a selected
 * organization, and each destination behind the roles that see it (03 §5). Settings, the organization and the
 * account are not routes: `?ajustes=<section>` opens the settings center over any of these screens.
 */
export const routes: Routes = [
  ...devRoutes,
  {
    path: 'ingresar',
    loadChildren: () => import('./iam/presentation/iam.routes').then((m) => m.iamRoutes),
  },
  ...organizationEntryRoutes,
  {
    path: 'platform',
    canActivate: [authGuard, operatorGuard],
    loadChildren: () =>
      import('./platform/presentation/platform.routes').then((m) => m.platformRoutes),
  },
  ...onboardingRoutes(SCREENS, [ESTABLISHMENT_LINE_PROVIDER, ESTABLISHMENT_ASSISTANT_PROVIDER]),
  {
    path: '',
    canActivate: [authGuard, organizationGuard],
    // The settings center opens over the frame's screens and shows these contexts' screens and state.
    providers: [{ provide: SETTINGS_SCREENS, useValue: SCREENS }, ACCOUNT_WORKSPACE_PROVIDER],
    loadComponent: () =>
      import('./organization/presentation/views/workspace/workspace').then((m) => m.Workspace),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'agenda' },
      ...MAIN_NAVIGATION.map((item) => ({
        path: item.path.slice(1),
        canActivate: [roleGuard(item.roles)],
        ...CONTEXT_ROUTES[item.path],
      })),
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
