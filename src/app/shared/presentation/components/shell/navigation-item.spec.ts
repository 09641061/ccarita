import { activeItem, navigationFor } from './navigation-item';

describe('navigationFor', () => {
  const paths = (role: 'owner' | 'manager' | 'staff') => navigationFor(role).map((i) => i.path);

  it('gives owners and managers the daily work and the team', () => {
    expect(paths('owner')).toEqual(['/agenda', '/mensajes', '/clientes', '/equipo']);
    expect(paths('manager')).toEqual(['/agenda', '/mensajes', '/clientes', '/equipo']);
  });

  it('gives staff the daily work only', () => {
    expect(paths('staff')).toEqual(['/agenda', '/mensajes', '/clientes']);
  });
});

describe('activeItem', () => {
  const items = navigationFor('owner');
  const active = (url: string) => activeItem(items, url)?.path ?? null;

  it('picks the destination a URL is inside, settings open or not', () => {
    expect(active('/agenda/citas/a-1')).toBe('/agenda');
    expect(active('/mensajes?ajustes=whatsapp')).toBe('/mensajes');
  });

  it('matches whole segments only', () => {
    expect(active('/agendax')).toBeNull();
    expect(active('/sin-permiso')).toBeNull();
  });
});
