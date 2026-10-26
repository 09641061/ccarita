import { Routes } from '@angular/router';

/** Cuenta (`/cuenta`), inside the signed-in frame; the app's routes provide `ACCOUNT_WORKSPACE`. */
export const accountRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./views/account/account').then((m) => m.Account),
    title: 'Cuenta · Takodu',
  },
];
