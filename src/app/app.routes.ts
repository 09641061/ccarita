import { computed, inject } from '@angular/core';
import { ResolveFn, Route, Routes } from '@angular/router';
import { InboxStore, WhatsappLineStore } from './conversations/public-api';
import { CUSTOMER_ACCESS } from './customers/public-api';
import { devRoutes } from './dev.routes';
import { authGuard } from './iam/public-api';
import {
  CurrentOrganization,
  ESTABLISHMENT_LINE,
  onboardingRoutes,
  organizationEntryRoutes,
  organizationGuard,
  roleGuard,
  settingsRoutes,
} from './organization/public-api';
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

/** The establishment's WhatsApp line, a screen of `conversations` inside Ajustes and Primeros pasos. */
const WHATSAPP_LINE: Route = {
  loadComponent: () =>
    import('./conversations/presentation/views/line-settings/line-settings').then(
      (m) => m.LineSettings,
    ),
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
  '/ajustes': { children: settingsRoutes(WHATSAPP_LINE) },
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
  ...onboardingRoutes(WHATSAPP_LINE, ESTABLISHMENT_LINE_PROVIDER),
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
