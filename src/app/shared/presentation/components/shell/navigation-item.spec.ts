import { activeItem, navigationFor } from './navigation-item';

describe('navigationFor', () => {
  const paths = (role: 'owner' | 'manager' | 'staff') => navigationFor(role).map((i) => i.path);

  it('gives the owner every destination', () => {
    expect(paths('owner')).toEqual([
      '/agenda',
      '/bandeja',
      '/clientes',
      '/asistente',
      '/equipo',
      '/ajustes',
      '/organizacion',
      '/cuenta',
    ]);
  });

  it('keeps the organization away from managers', () => {
    expect(paths('manager')).not.toContain('/organizacion');
    expect(paths('manager')).toContain('/equipo');
  });

  it('gives staff the daily work and their account only', () => {
    expect(paths('staff')).toEqual(['/agenda', '/bandeja', '/clientes', '/cuenta']);
  });
});

describe('activeItem', () => {
  const items = navigationFor('owner');
  const active = (url: string) => activeItem(items, url)?.path ?? null;

  it('picks the destination by the longest matching path', () => {
    expect(active('/ajustes/horario')).toBe('/ajustes');
    expect(active('/ajustes/asistente')).toBe('/asistente');
    expect(active('/ajustes/uso?x=1')).toBe('/asistente');
    expect(active('/agenda/citas/a-1')).toBe('/agenda');
  });

  it('matches whole segments only', () => {
    expect(active('/ajustesx')).toBeNull();
    expect(active('/mas')).toBeNull();
  });
});
