import { Member } from './member';
import { MemberRole, canPerform } from './member-role';

/**
 * The signed-in member looking at the team, and what the Equipo page offers them on each row (03 §5, O12). pibble
 * enforces the same rules and decides; this only hides what would fail. A member's own role and membership are
 * left alone here, so nobody locks themselves out by mistake.
 */
export class TeamCaller {
  constructor(
    readonly memberId: string,
    readonly role: MemberRole,
  ) {}

  /** 03 §5: owners and managers manage the team. */
  get managesTeam(): boolean {
    return canPerform(this.role, 'manageTeam');
  }

  /** 03 §5, O12: only the owner transfers ownership. */
  get transfersOwnership(): boolean {
    return this.role === 'owner';
  }

  /** Name, bookability and, where allowed, role and establishments; managers leave the owner alone. */
  canEdit(member: Member): boolean {
    return this.managesTeam && (!member.isOwner || this.role === 'owner');
  }

  /** O12: the owner's role never changes; the caller's own neither. */
  canChangeRoleOf(member: Member): boolean {
    return this.canEdit(member) && !member.isOwner && member.id !== this.memberId;
  }

  /** O12: the owner cannot be removed; the caller does not remove themselves. */
  canRemove(member: Member): boolean {
    return this.canChangeRoleOf(member);
  }

  /** O10: pending invitations can be sent again. */
  canRenew(member: Member): boolean {
    return this.managesTeam && member.status === 'pending';
  }

  /** O12: the new owner must have joined. */
  canTransferTo(member: Member): boolean {
    return this.transfersOwnership && member.status === 'active' && !member.isOwner;
  }
}
