import { Injectable, computed, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { InviteMember, Member, UpdateMember } from '../domain/model/member';
import { TeamCaller } from '../domain/model/team-caller';
import { MembersApi } from '../infrastructure/members.api';
import { OwnershipTransfersApi } from '../infrastructure/ownership-transfers.api';
import { CurrentOrganization } from './current-organization.store';
import { EstablishmentTeam } from './establishment-team.store';

/**
 * The Equipo page: the organization's members and invitations, shared with `EstablishmentTeam` so the calendar and
 * services see every change, and the use cases of O10–O12. After a change that can drop a member from services
 * (O15), the services reload too.
 */
@Injectable({ providedIn: 'root' })
export class TeamStore {
  private readonly api = inject(MembersApi);
  private readonly transfers = inject(OwnershipTransfersApi);
  private readonly organization = inject(CurrentOrganization);
  private readonly team = inject(EstablishmentTeam);

  readonly members = this.team.members;

  /** The signed-in member, for what each row offers; `null` until the organization is known. */
  readonly caller = computed(() => {
    const memberId = this.organization.memberId();
    const role = this.organization.role();
    return memberId && role ? new TeamCaller(memberId, role) : null;
  });

  /** @throws ApiError `MEMBER_CONFLICT` (O11), `ESTABLISHMENT_NOT_FOUND`, `VALIDATION_ERROR`. */
  async invite(command: InviteMember, idempotencyKey: string): Promise<Member> {
    const invited = await firstValueFrom(this.api.invite(command, idempotencyKey));
    this.members.reload();
    return invited;
  }

  /** @throws ApiError `OWNER_CHANGE_NOT_ALLOWED` (O12), `MEMBER_NOT_FOUND`. */
  async update(memberId: string, command: UpdateMember): Promise<Member> {
    const updated = await firstValueFrom(this.api.update(memberId, command));
    this.reloadAll();
    return updated;
  }

  /** @throws ApiError `MEMBER_HAS_UPCOMING_APPOINTMENTS`, `OWNER_CHANGE_NOT_ALLOWED` (O12). */
  async remove(memberId: string): Promise<void> {
    await firstValueFrom(this.api.remove(memberId), { defaultValue: undefined });
    this.reloadAll();
  }

  /** @throws ApiError `INVITATION_NOT_PENDING`. */
  async renewInvitation(memberId: string, idempotencyKey: string): Promise<Member> {
    const renewed = await firstValueFrom(this.api.renewInvitation(memberId, idempotencyKey));
    this.members.reload();
    return renewed;
  }

  /**
   * O12: the caller becomes a manager, so the memberships are read again and the role, the navigation and every
   * screen follow it.
   * @throws ApiError `MEMBER_NOT_ACTIVE`, `OWNER_CONFLICT`, `ACCESS_DENIED`.
   */
  async transferOwnership(newOwnerId: string, idempotencyKey: string): Promise<Member> {
    const owner = await firstValueFrom(this.transfers.transfer(newOwnerId, idempotencyKey));
    await this.organization.load(true);
    this.members.reload();
    return owner;
  }

  private reloadAll(): void {
    this.members.reload();
    this.team.services.reload();
  }
}
