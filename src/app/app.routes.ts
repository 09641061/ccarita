import { Routes } from '@angular/router';
import { Layout } from './shared/presentation/components/layout/layout';

const pageNotFound = () =>
  import('./shared/presentation/views/page-not-found/page-not-found').then((m) => m.PageNotFound);

/** Each context adds one lazy entry (`loadChildren: () => import('./<context>/presentation/<context>.routes')`). */
export const routes: Routes = [
  { path: '', component: Layout, children: [] },
  { path: '**', loadComponent: pageNotFound, title: 'Takodu' },
];
