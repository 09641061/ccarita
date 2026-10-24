import { Member } from './member';

describe('Member', () => {
  const member = (role: 'owner' | 'staff', overrides: Partial<Member> = {}) =>
    Object.assign(
      new Member(
        'm-1',
        'a@example.com',
        'Ana',
        role,
        true,
        'active',
        role === 'staff' ? ['est-1'] : [],
      ),
      overrides,
    );

  it('O13: owners work everywhere, staff only where assigned', () => {
    expect(member('owner').worksAt('est-2')).toBe(true);
    expect(member('staff').worksAt('est-1')).toBe(true);
    expect(member('staff').worksAt('est-2')).toBe(false);
  });

  it('O15: only active, bookable members take appointments', () => {
    expect(member('staff').takesAppointmentsAt('est-1')).toBe(true);
    expect(member('staff', { bookable: false }).takesAppointmentsAt('est-1')).toBe(false);
    expect(member('staff', { status: 'pending' }).takesAppointmentsAt('est-1')).toBe(false);
  });
});
