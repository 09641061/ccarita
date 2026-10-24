import { navigationFor } from './navigation-item';

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
