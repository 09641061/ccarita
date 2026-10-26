import { Route } from '@angular/router';
import { routes } from './app.routes';

describe('routes', () => {
  const workspace = routes.find((route) => route.path === '' && route.children)!;
  const child = (path: string): Route => workspace.children!.find((route) => route.path === path)!;

  it('opens the assistant inside Ajustes, which the role guard protects', () => {
    expect(child('asistente')).toMatchObject({ redirectTo: '/ajustes/asistente' });
    expect(child('asistente').canActivate).toBeUndefined();
    expect(child('ajustes').canActivate).toHaveLength(1);
  });
});
