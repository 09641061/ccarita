import { OrganizationAccount, PlanName } from './organization-account';

const NOW = new Date('2026-10-26T15:00:00Z');
const account = (plan: PlanName, establishments: number, until: string | null = null) =>
  new OrganizationAccount(
    'org-1',
    'Peluquería Doña Rosa',
    plan,
    until ? new Date(until) : null,
    !!until && new Date(until) > NOW,
    'rosa@gmail.com',
    establishments,
  );

describe('OrganizationAccount', () => {
  it('O4: standard allows one active establishment, max any number', () => {
    expect(account('standard', 1).overLimit).toBe(false);
    expect(account('standard', 2).overLimit).toBe(true);
    expect(account('max', 9).overLimit).toBe(false);
    expect(account('max', 9).establishmentLimit).toBeNull();
  });

  it('matches the name or the owner email, ignoring case and accents', () => {
    expect(account('max', 1).matches('peluqueria')).toBe(true);
    expect(account('max', 1).matches('ROSA@')).toBe(true);
    expect(account('max', 1).matches('  ')).toBe(true);
    expect(account('max', 1).matches('barber')).toBe(false);
  });

  it('O5: extends from the current end while active, from now once ended', () => {
    expect(account('max', 1, '2026-11-01T05:00:00Z').endAfterExtending(30, NOW)).toEqual(
      new Date('2026-12-01T05:00:00Z'),
    );
    expect(account('max', 1, '2026-10-01T05:00:00Z').endAfterExtending(30, NOW)).toEqual(
      new Date('2026-11-25T15:00:00Z'),
    );
    expect(account('max', 1).endAfterExtending(1, NOW)).toEqual(new Date('2026-10-27T15:00:00Z'));
  });
});
