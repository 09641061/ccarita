import { Route } from '@angular/router';
import { routes } from './app.routes';
import { MAIN_NAVIGATION } from './shared/presentation/components/shell/navigation-item';

describe('routes', () => {
  const workspace = routes.find((route) => route.path === '' && route.children)!;
  const child = (path: string): Route => workspace.children!.find((route) => route.path === path)!;

  it('opens the assistant inside Ajustes, which the role guard protects', () => {
    expect(child('asistente')).toMatchObject({ redirectTo: '/ajustes/asistente' });
    expect(child('asistente').canActivate).toBeUndefined();
    expect(child('ajustes').canActivate).toHaveLength(1);
  });

  it('mounts Equipo, Organización and Cuenta behind their roles, with no placeholder left', () => {
    for (const path of ['equipo', 'organizacion', 'cuenta']) {
      expect(child(path).children ?? child(path).loadChildren).toBeDefined();
      expect(child(path).loadComponent).toBeUndefined();
      expect(child(path).canActivate).toHaveLength(1);
    }
    const roles = (path: string) => MAIN_NAVIGATION.find((item) => item.path === path)!.roles;
    expect(roles('/equipo')).toEqual(['owner', 'manager']);
    expect(roles('/organizacion')).toEqual(['owner']);
    expect(roles('/cuenta')).toEqual(['owner', 'manager', 'staff']);
    expect(child('cuenta').providers).toHaveLength(1);
  });
});
