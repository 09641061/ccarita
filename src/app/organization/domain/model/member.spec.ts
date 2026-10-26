import { Member, assignmentProblem } from './member';

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

  it('O10: a pending invitation expires when its 7 days pass', () => {
    const expiresAt = new Date('2026-11-02T15:00:00Z');
    const invited = member('staff', { status: 'pending', inviteExpiresAt: expiresAt });
    expect(invited.invitationExpired(new Date('2026-11-02T14:59:59Z'))).toBe(false);
    expect(invited.invitationExpired(expiresAt)).toBe(true);
    expect(member('staff').invitationExpired(new Date('2027-01-01T00:00:00Z'))).toBe(false);
  });

  it('O13: staff need an establishment, managers none', () => {
    expect(assignmentProblem('staff', [])).toBe('noEstablishment');
    expect(assignmentProblem('staff', ['est-1'])).toBeNull();
    expect(assignmentProblem('manager', [])).toBeNull();
  });
});
