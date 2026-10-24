import { Routes } from '@angular/router';

/** Development-only screens; production builds replace this file with dev.routes.production.ts. */
export const devRoutes: Routes = [
  {
    path: 'dev/ui',
    loadComponent: () =>
      import('./shared/presentation/views/style-guide/style-guide').then((m) => m.StyleGuide),
    title: 'Guía de estilo · Takodu',
  },
];
