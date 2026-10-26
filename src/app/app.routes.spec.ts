import { Route } from '@angular/router';
import { routes } from './app.routes';
import { ACCOUNT_WORKSPACE } from './iam/public-api';
import { SETTINGS_SCREENS } from './organization/public-api';

describe('routes', () => {
  const workspace = routes.find((route) => route.path === '' && route.children)!;
  const child = (path: string): Route => workspace.children!.find((route) => route.path === path)!;

  it('mounts each destination behind its roles, with the settings center outside the routes', () => {
    expect(workspace.children!.map((route) => route.path)).toEqual([
      '',
      'agenda',
      'mensajes',
      'clientes',
      'equipo',
      'sin-permiso',
    ]);
    for (const path of ['agenda', 'mensajes', 'clientes', 'equipo']) {
      expect(child(path).canActivate).toHaveLength(1);
    }
    const tokens = (workspace.providers ?? []).map((p) => (p as { provide: unknown }).provide);
    expect(tokens).toContain(SETTINGS_SCREENS);
    expect(tokens).toContain(ACCOUNT_WORKSPACE);
  });

  it('mounts the Takodu team area outside the workspace, behind sign-in and the operator check', () => {
    const platform = routes.find((route) => route.path === 'platform')!;
    expect(platform.canActivate).toHaveLength(2);
    expect(platform.loadChildren).toBeDefined();
    expect(routes.indexOf(platform)).toBeLessThan(routes.indexOf(workspace));
  });
});
