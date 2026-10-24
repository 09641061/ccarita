import { Routes } from '@angular/router';

export const iamRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./views/sign-in/sign-in').then((m) => m.SignIn),
    title: 'Ingresar · Takodu',
  },
];
