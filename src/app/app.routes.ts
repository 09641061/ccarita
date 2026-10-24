import { Routes } from '@angular/router';
import { devRoutes } from './dev.routes';
import { navigationFor } from './shared/presentation/components/shell/navigation-item';

const pageNotFound = () =>
  import('./shared/presentation/views/page-not-found/page-not-found').then((m) => m.PageNotFound);
const placeholder = () =>
  import('./shared/presentation/views/placeholder/placeholder').then((m) => m.Placeholder);

/** The owner's destinations until the session (F2) knows the signed-in member's role. */
const navigation = navigationFor('owner');

/**
 * Each context replaces its placeholder with one lazy entry
 * (`loadChildren: () => import('./<context>/presentation/<context>.routes')`).
 */
export const routes: Routes = [
  ...devRoutes,
  {
    path: '',
    loadComponent: () =>
      import('./shared/presentation/views/shell-page/shell-page').then((m) => m.ShellPage),
    data: { navigation },
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'agenda' },
      ...navigation.map((item) => ({
        path: item.path.slice(1),
        loadComponent: placeholder,
        data: { label: item.label },
        title: 'Takodu',
      })),
      {
        path: 'mas',
        loadComponent: () => import('./shared/presentation/views/more/more').then((m) => m.More),
        data: { navigation },
        title: 'Takodu',
      },
    ],
  },
  { path: '**', loadComponent: pageNotFound, title: 'Takodu' },
];
