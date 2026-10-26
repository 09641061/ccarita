import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormField, email, form, maxLength, required } from '@angular/forms/signals';
import { MAT_BOTTOM_SHEET_DATA, MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatRadioModule } from '@angular/material/radio';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { TranslatePipe } from '@ngx-translate/core';
import { ApiError } from '../../../../shared/domain/model/api-error';
import { newIdempotencyKey } from '../../../../shared/domain/model/idempotency-key';
import { BusyButton } from '../../../../shared/presentation/components/busy-button/busy-button';
import { ErrorMessagePipe } from '../../../../shared/presentation/pipes/error-message.pipe';
import { TeamStore } from '../../../application/team.store';
import { Establishment } from '../../../domain/model/establishment';
import { AssignableRole, Member, assignmentProblem } from '../../../domain/model/member';
import { MemberRole } from '../../../domain/model/member-role';

export interface MemberSheetData {
  /** The member to edit, or `null` to invite someone. */
  readonly member: Member | null;
  /** O12: the owner's role and the caller's own stay as they are. */
  readonly canChangeRole: boolean;
  /** Where a staff member may work: the organization's open establishments. */
  readonly establishments: readonly Establishment[];
}

interface MemberModel {
  email: string;
  displayName: string;
}

/**
 * "Invitar a alguien" (O10) and editing a member (O9, O13, O15): name, role, whether they take appointments and,
 * for staff, where they work. Inviting sends one idempotency key per attempt, reused on a retry after a lost answer
 * and renewed when the input changes; editing is a PUT and sends none.
 */
@Component({
  selector: 'app-member-sheet',
  imports: [
    BusyButton,
    ErrorMessagePipe,
    FormField,
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatInputModule,
    MatRadioModule,
    MatSlideToggleModule,
    TranslatePipe,
  ],
  templateUrl: './member-sheet.html',
  styleUrls: ['../sheet.scss', './member-sheet.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MemberSheet {
  private readonly store = inject(TeamStore);
  private readonly ref = inject(MatBottomSheetRef<MemberSheet, boolean>);
  protected readonly data = inject<MemberSheetData>(MAT_BOTTOM_SHEET_DATA);
  protected readonly editing = this.data.member;

  protected readonly model = signal<MemberModel>({
    email: this.editing?.email ?? '',
    displayName: this.editing?.name ?? '',
  });
  protected readonly memberForm = form(this.model, (path) => {
    required(path.email);
    email(path.email);
    maxLength(path.email, 254);
    required(path.displayName);
    maxLength(path.displayName, 120);
  });
  protected readonly role = signal<MemberRole>(this.editing?.role ?? 'staff');
  protected readonly bookable = signal(this.editing?.bookable ?? true);
  protected readonly chosen = signal<ReadonlySet<string>>(
    new Set(
      this.editing?.establishmentIds ??
        (this.data.establishments.length === 1 ? [this.data.establishments[0].id] : []),
    ),
  );

  /** O13: staff pick their establishments; owners and managers work everywhere. */
  protected readonly picksEstablishments = computed(() => this.role() === 'staff');
  protected readonly attempted = signal(false);
  protected readonly problem = computed(() => assignmentProblem(this.role(), [...this.chosen()]));
  protected readonly busy = signal(false);
  protected readonly error = signal<ApiError | null>(null);
  private key = newIdempotencyKey();
  private keyInput: string | null = null;

  protected chooseRole(role: AssignableRole): void {
    this.role.set(role);
  }

  protected toggle(establishmentId: string, checked: boolean): void {
    const next = new Set(this.chosen());
    if (checked) next.add(establishmentId);
    else next.delete(establishmentId);
    this.chosen.set(next);
  }

  protected async submit(event?: Event): Promise<void> {
    event?.preventDefault();
    this.attempted.set(true);
    this.memberForm().markAsTouched();
    const { email, displayName } = this.model();
    if (this.busy() || this.memberForm().invalid() || !displayName.trim() || this.problem()) return;
    const establishmentIds = this.data.establishments
      .map((e) => e.id)
      .filter((id) => this.chosen().has(id));
    this.busy.set(true);
    this.error.set(null);
    try {
      if (this.editing) {
        await this.store.update(this.editing.id, {
          displayName,
          bookable: this.bookable(),
          role: this.role(),
          establishmentIds,
        });
      } else {
        await this.invite({
          email,
          displayName,
          role: this.role() as AssignableRole,
          bookable: this.bookable(),
          establishmentIds,
        });
      }
      this.ref.dismiss(true);
    } catch (error) {
      const failure = ApiError.of(error);
      this.error.set(failure);
      if (!failure.retryable) {
        this.key = newIdempotencyKey();
        this.keyInput = null;
      }
    } finally {
      this.busy.set(false);
    }
  }

  protected cancel(): void {
    this.ref.dismiss(false);
  }

  /** O10. A retry after a lost answer sends the same key, so one invitation is emailed. */
  private async invite(command: Parameters<TeamStore['invite']>[0]): Promise<void> {
    const input = JSON.stringify(command);
    if (this.keyInput !== null && this.keyInput !== input) this.key = newIdempotencyKey();
    this.keyInput = input;
    await this.store.invite(command, this.key);
  }
}
