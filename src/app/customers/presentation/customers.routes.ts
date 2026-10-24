import { Routes } from '@angular/router';

/** `/clientes`: the list, with a customer's detail or form as its child. */
export const customersRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./views/customer-list/customer-list').then((m) => m.CustomerList),
    title: 'Clientes · Takodu',
    children: [
      {
        path: 'nuevo',
        loadComponent: () =>
          import('./views/customer-form/customer-form').then((m) => m.CustomerForm),
        title: 'Nuevo cliente · Takodu',
      },
      {
        path: ':customerId',
        loadComponent: () =>
          import('./views/customer-detail/customer-detail').then((m) => m.CustomerDetail),
        title: 'Cliente · Takodu',
      },
      {
        path: ':customerId/editar',
        loadComponent: () =>
          import('./views/customer-form/customer-form').then((m) => m.CustomerForm),
        title: 'Editar cliente · Takodu',
      },
    ],
  },
];
