import { Member } from './member';
import { TeamCaller } from './team-caller';

const member = (id: string, role: 'owner' | 'manager' | 'staff', status: 'active' | 'pending') =>
  new Member(id, `${id}@example.com`, id, role, true, status, role === 'staff' ? ['est-1'] : []);

const owner = member('m-owner', 'owner', 'active');
const manager = member('m-manager', 'manager', 'active');
const staff = member('m-staff', 'staff', 'active');
const invited = member('m-invited', 'staff', 'pending');

describe('TeamCaller', () => {
  it('03 §5: the owner edits everyone, changes every role but their own, and removes the rest', () => {
    const caller = new TeamCaller(owner.id, 'owner');
    expect([owner, manager, staff, invited].map((m) => caller.canEdit(m))).toEqual([
      true,
      true,
      true,
      true,
    ]);
    expect(caller.canChangeRoleOf(owner)).toBe(false);
    expect(caller.canRemove(owner)).toBe(false);
    expect(caller.canRemove(manager)).toBe(true);
  });

  it('03 §5, O12: a manager leaves the owner and themselves alone', () => {
    const caller = new TeamCaller(manager.id, 'manager');
    expect(caller.canEdit(owner)).toBe(false);
    expect(caller.canRemove(owner)).toBe(false);
    expect(caller.canEdit(manager)).toBe(true);
    expect(caller.canChangeRoleOf(manager)).toBe(false);
    expect(caller.canRemove(manager)).toBe(false);
    expect(caller.canChangeRoleOf(staff)).toBe(true);
    expect(caller.canRemove(invited)).toBe(true);
    expect(caller.transfersOwnership).toBe(false);
  });

  it('03 §5: staff manage nothing', () => {
    const caller = new TeamCaller(staff.id, 'staff');
    expect(caller.managesTeam).toBe(false);
    expect(caller.canEdit(invited)).toBe(false);
    expect(caller.canRenew(invited)).toBe(false);
  });

  it('O10: only pending invitations are sent again', () => {
    const caller = new TeamCaller(owner.id, 'owner');
    expect(caller.canRenew(invited)).toBe(true);
    expect(caller.canRenew(staff)).toBe(false);
  });

  it('O12: ownership goes only to a member who joined', () => {
    const caller = new TeamCaller(owner.id, 'owner');
    expect(caller.canTransferTo(manager)).toBe(true);
    expect(caller.canTransferTo(invited)).toBe(false);
    expect(caller.canTransferTo(owner)).toBe(false);
    expect(new TeamCaller(manager.id, 'manager').canTransferTo(staff)).toBe(false);
  });
});
