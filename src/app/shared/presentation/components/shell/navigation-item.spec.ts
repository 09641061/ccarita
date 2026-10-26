import { activeItem, navigationFor } from './navigation-item';

describe('navigationFor', () => {
  const paths = (role: 'owner' | 'manager' | 'staff') => navigationFor(role).map((i) => i.path);

  it('gives owners and managers the daily work and the team', () => {
    expect(paths('owner')).toEqual(['/agenda', '/bandeja', '/clientes', '/equipo']);
    expect(paths('manager')).toEqual(['/agenda', '/bandeja', '/clientes', '/equipo']);
  });

  it('gives staff the daily work only', () => {
    expect(paths('staff')).toEqual(['/agenda', '/bandeja', '/clientes']);
  });
});

describe('activeItem', () => {
  const items = navigationFor('owner');
  const active = (url: string) => activeItem(items, url)?.path ?? null;

  it('picks the destination a URL is inside, settings open or not', () => {
    expect(active('/agenda/citas/a-1')).toBe('/agenda');
    expect(active('/bandeja?ajustes=whatsapp')).toBe('/bandeja');
  });

  it('matches whole segments only', () => {
    expect(active('/agendax')).toBeNull();
    expect(active('/sin-permiso')).toBeNull();
  });
});
