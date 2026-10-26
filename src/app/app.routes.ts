import { computed, inject } from '@angular/core';
import { AssistantSettingsStore } from './assistant/public-api';
import { ResolveFn, Route, Routes } from '@angular/router';
import { InboxStore, WhatsappLineStore } from './conversations/public-api';
import { CUSTOMER_ACCESS } from './customers/public-api';
import { devRoutes } from './dev.routes';
import { ACCOUNT_WORKSPACE, accountRoutes, authGuard } from './iam/public-api';
import {
  CurrentEstablishment,
  CurrentOrganization,
  ESTABLISHMENT_ASSISTANT,
  ESTABLISHMENT_LINE,
  onboardingRoutes,
  organizationEntryRoutes,
  organizationGuard,
  organizationPageRoutes,
  roleGuard,
  SettingsScreens,
  settingsRoutes,
  teamRoutes,
} from './organization/public-api';
import { operatorGuard } from './platform/public-api';
import { ApiError } from './shared/domain/model/api-error';
import {
  MAIN_NAVIGATION,
  NavigationItem,
  navigationFor,
} from './shared/presentation/components/shell/navigation-item';

const pageNotFound = () =>
  import('./shared/presentation/views/page-not-found/page-not-found').then((m) => m.PageNotFound);
const placeholder = () =>
  import('./shared/presentation/views/placeholder/placeholder').then((m) => m.Placeholder);

/** The screens of `conversations` and `assistant` inside Ajustes and Primeros pasos. */
const SETTINGS_SCREENS: SettingsScreens = {
  whatsapp: {
    loadComponent: () =>
      import('./conversations/presentation/views/line-settings/line-settings').then(
        (m) => m.LineSettings,
      ),
  },
  assistant: {
    loadComponent: () =>
      import('./assistant/presentation/views/assistant-configuration/assistant-configuration').then(
        (m) => m.AssistantConfiguration,
      ),
  },
  usage: {
    loadComponent: () =>
      import('./assistant/presentation/views/usage-report/usage-report').then((m) => m.UsageReport),
  },
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

/** Cuenta shows times in the selected establishment's zone and offers another organization when there is one. */
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

/** The destinations a context already serves; the others show a placeholder until their phase. */
const CONTEXT_ROUTES: Record<string, Route> = {
  '/agenda': {
    loadChildren: () =>
      import('./booking/presentation/booking.routes').then((m) => m.bookingRoutes),
  },
  '/bandeja': {
    loadChildren: () =>
      import('./conversations/presentation/conversations.routes').then(
        (m) => m.conversationsRoutes,
      ),
  },
  '/ajustes': { children: settingsRoutes(SETTINGS_SCREENS) },
  // The assistant lives in Ajustes; its navigation item opens it there and stays active.
  '/asistente': { pathMatch: 'full', redirectTo: '/ajustes/asistente' },
  '/equipo': { children: teamRoutes },
  '/organizacion': { children: organizationPageRoutes },
  '/cuenta': { providers: [ACCOUNT_WORKSPACE_PROVIDER], children: accountRoutes },
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

/** The destinations of the signed-in member's role, for the phone's "Más". */
const roleNavigation: ResolveFn<readonly NavigationItem[]> = async () => {
  const organization = inject(CurrentOrganization);
  await organization.load();
  return navigationFor(organization.role() ?? 'staff');
};

/**
 * Sign-in, the organization picker, invitations and the Takodu team's area (`/platform`, behind pibble's operator
 * check, with no organization) stand alone; everything else is inside `Workspace`, behind a
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
    path: 'platform',
    canActivate: [authGuard, operatorGuard],
    loadChildren: () =>
      import('./platform/presentation/platform.routes').then((m) => m.platformRoutes),
  },
  ...onboardingRoutes(SETTINGS_SCREENS, [
    ESTABLISHMENT_LINE_PROVIDER,
    ESTABLISHMENT_ASSISTANT_PROVIDER,
  ]),
  {
    path: '',
    canActivate: [authGuard, organizationGuard],
    loadComponent: () =>
      import('./organization/presentation/views/workspace/workspace').then((m) => m.Workspace),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'agenda' },
      ...MAIN_NAVIGATION.map((item) => ({
        path: item.path.slice(1),
        // Redirects run before guards, and Angular refuses both on one route; the target is guarded.
        ...(CONTEXT_ROUTES[item.path]?.redirectTo ? {} : { canActivate: [roleGuard(item.roles)] }),
        ...(CONTEXT_ROUTES[item.path] ?? {
          loadComponent: placeholder,
          data: { label: item.label },
          title: 'Takodu',
        }),
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
