import { BreakpointObserver } from '@angular/cdk/layout';
import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { map } from 'rxjs';
import { ApiError } from '../../../../shared/domain/model/api-error';
import { newIdempotencyKey } from '../../../../shared/domain/model/idempotency-key';
import { Avatar } from '../../../../shared/presentation/components/avatar/avatar';
import { Skeleton } from '../../../../shared/presentation/components/skeleton/skeleton';
import {
  StateKind,
  StateView,
} from '../../../../shared/presentation/components/state-view/state-view';
import { ErrorMessagePipe } from '../../../../shared/presentation/pipes/error-message.pipe';
import { ZonedDatePipe } from '../../../../shared/presentation/pipes/zoned-date.pipe';
import { CurrentEstablishment } from '../../../application/current-establishment.store';
import { CurrentOrganization } from '../../../application/current-organization.store';
import { TeamStore } from '../../../application/team.store';
import { Member } from '../../../domain/model/member';
import { MemberDialog, MemberDialogData } from '../member-dialog/member-dialog';
import { RemoveMemberDialog } from '../remove-member-dialog/remove-member-dialog';
import { TransferOwnershipDialog } from '../transfer-ownership-dialog/transfer-ownership-dialog';
import { DIALOG_OPTIONS } from '../../../../shared/presentation/dialog-options';

const LIMA = 'America/Lima';

/** A row of the team as the page shows it. */
interface TeamRow {
  readonly member: Member;
  readonly establishments: string | null;
  readonly expired: boolean;
  readonly self: boolean;
  readonly canEdit: boolean;
  readonly canRenew: boolean;
  readonly canRemove: boolean;
}

/**
 * Equipo (`/equipo`), for owners and managers (03 §5): members and pending invitations, inviting (O10), editing
 * roles, bookability and establishments (O9, O13, O15), removing or revoking, sending an invitation again, and the
 * owner's transfer (O12). Team management stays enabled with an inactive plan (O6). Inviting, renewing and
 * transferring send one idempotency key per action, reused on a retry after a lost answer.
 */
@Component({
  selector: 'app-team',
  imports: [
    Avatar,
    ErrorMessagePipe,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatProgressBarModule,
    NgTemplateOutlet,
    Skeleton,
    StateView,
    TranslatePipe,
    ZonedDatePipe,
  ],
  templateUrl: './team.html',
  styleUrl: './team.scss',
  host: { '[class.desktop]': 'desktop()' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Team {
  private readonly dialog = inject(MatDialog);
  private readonly translate = inject(TranslateService);
  protected readonly store = inject(TeamStore);
  protected readonly organization = inject(CurrentOrganization);
  private readonly establishment = inject(CurrentEstablishment);

  protected readonly desktop = toSignal(
    inject(BreakpointObserver)
      .observe('(min-width: 1024px)')
      .pipe(map((state) => state.matches)),
    { initialValue: false },
  );
  protected readonly timeZone = computed(() => this.establishment.timeZone() ?? LIMA);
  /** The page was opened at this instant; expiry is judged against it. */
  private readonly now = signal(new Date());

  protected readonly loadError = computed(() => {
    const error = this.store.members.error();
    return error ? ApiError.of(error) : null;
  });
  protected readonly errorKind = computed<StateKind>(() => {
    switch (this.loadError()?.code) {
      case 'ACCESS_DENIED':
        return 'forbidden';
      case 'NETWORK_ERROR':
        return 'offline';
      default:
        return 'error';
    }
  });

  protected readonly rows = computed<readonly TeamRow[]>(() => {
    const caller = this.store.caller();
    const names = new Map(this.establishment.list.value().map((e) => [e.id, e.name]));
    const now = this.now();
    return this.store.members.value().map((member) => ({
      member,
      establishments:
        member.role === 'staff'
          ? member.establishmentIds
              .map((id) => names.get(id) ?? '')
              .filter(Boolean)
              .join(', ')
          : null,
      expired: member.invitationExpired(now),
      self: member.id === caller?.memberId,
      canEdit: caller?.canEdit(member) ?? false,
      canRenew: caller?.canRenew(member) ?? false,
      canRemove: caller?.canRemove(member) ?? false,
    }));
  });
  protected readonly canTransfer = computed(() =>
    this.store.members.value().some((member) => this.store.caller()?.canTransferTo(member)),
  );

  /** The member whose invitation is being sent again, what happened, and the key of the last failed attempt. */
  protected readonly renewing = signal<string | null>(null);
  protected readonly renewal = signal<{ id: string; error: ApiError | null } | null>(null);
  private readonly retryKeys = new Map<string, string>();
  protected readonly transferred = signal<string | null>(null);

  protected invite(): void {
    this.openMemberDialog({ member: null, canChangeRole: true });
  }

  protected edit(row: TeamRow): void {
    this.openMemberDialog({
      member: row.member,
      canChangeRole: this.store.caller()?.canChangeRoleOf(row.member) ?? false,
    });
  }

  protected remove(member: Member): void {
    this.dialog.open(RemoveMemberDialog, {
      ...DIALOG_OPTIONS,
      data: member,
      ariaLabel: this.translate.instant(
        member.status === 'pending'
          ? 'organization.team.removeSheet.revokeTitle'
          : 'organization.team.removeSheet.removeTitle',
        { name: member.name },
      ),
    });
  }

  protected transfer(): void {
    this.transferred.set(null);
    this.dialog
      .open<TransferOwnershipDialog, readonly Member[], Member | undefined>(
        TransferOwnershipDialog,
        {
          ...DIALOG_OPTIONS,
          data: this.store.members
            .value()
            .filter((member) => this.store.caller()?.canTransferTo(member)),
          ariaLabel: this.translate.instant('organization.team.transferSheet.title'),
        },
      )
      .afterClosed()
      .subscribe((owner) => this.transferred.set(owner?.name ?? null));
  }

  /** O10. A retry after a lost answer sends the same key, so one link is emailed. */
  protected async renew(member: Member): Promise<void> {
    if (this.renewing()) return;
    const key = this.retryKeys.get(member.id) ?? newIdempotencyKey();
    this.renewing.set(member.id);
    this.renewal.set(null);
    try {
      await this.store.renewInvitation(member.id, key);
      this.retryKeys.delete(member.id);
      this.renewal.set({ id: member.id, error: null });
    } catch (error) {
      const failure = ApiError.of(error);
      if (failure.retryable) this.retryKeys.set(member.id, key);
      else this.retryKeys.delete(member.id);
      this.renewal.set({ id: member.id, error: failure });
    } finally {
      this.renewing.set(null);
      this.now.set(new Date());
    }
  }

  private openMemberDialog(data: Omit<MemberDialogData, 'establishments'>): void {
    this.dialog.open(MemberDialog, {
      ...DIALOG_OPTIONS,
      data: { ...data, establishments: this.establishment.establishments() },
      ariaLabel: this.translate.instant(
        data.member ? 'organization.team.sheet.editTitle' : 'organization.team.sheet.inviteTitle',
        { name: data.member?.name ?? '' },
      ),
    });
  }
}
