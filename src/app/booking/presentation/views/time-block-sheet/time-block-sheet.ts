import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormField, form, maxLength, required } from '@angular/forms/signals';
import { MAT_BOTTOM_SHEET_DATA, MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { TranslatePipe } from '@ngx-translate/core';
import { Member } from '../../../../organization/public-api';
import { ApiError } from '../../../../shared/domain/model/api-error';
import { LocalDate } from '../../../../shared/domain/model/local-date';
import { newIdempotencyKey } from '../../../../shared/domain/model/idempotency-key';
import { BusyButton } from '../../../../shared/presentation/components/busy-button/busy-button';
import { ErrorMessagePipe } from '../../../../shared/presentation/pipes/error-message.pipe';
import { CalendarStore } from '../../../application/calendar.store';

export interface TimeBlockSheetData {
  readonly day: LocalDate;
  readonly timeZone: string;
  /** Whom the signed-in member may block: everyone for owners and managers, themselves for staff (B15). */
  readonly members: readonly Member[];
  readonly memberId: string | null;
  readonly managesEveryone: boolean;
}

const WHOLE = '';

/**
 * "Bloquear horario" (B15): a range of the establishment's days and times for one member or, for owners and
 * managers, the whole establishment. It cancels nothing; the calendar then shows what collides. Works while the
 * plan is inactive (O6).
 */
@Component({
  selector: 'app-time-block-sheet',
  imports: [
    BusyButton,
    ErrorMessagePipe,
    FormField,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    TranslatePipe,
  ],
  templateUrl: './time-block-sheet.html',
  styleUrl: '../sheet.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TimeBlockSheet {
  private readonly store = inject(CalendarStore);
  private readonly ref = inject(MatBottomSheetRef<TimeBlockSheet>);
  protected readonly data = inject<TimeBlockSheetData>(MAT_BOTTOM_SHEET_DATA);
  protected readonly whole = WHOLE;

  protected readonly model = signal({
    who: this.data.memberId ?? WHOLE,
    startDate: this.data.day.toString(),
    startTime: '13:00',
    endDate: this.data.day.toString(),
    endTime: '14:00',
    reason: '',
  });
  protected readonly blockForm = form(this.model, (path) => {
    required(path.startDate);
    required(path.startTime);
    required(path.endDate);
    required(path.endTime);
    maxLength(path.reason, 500);
  });

  protected readonly range = computed(() => {
    const { startDate, startTime, endDate, endTime } = this.model();
    try {
      return {
        start: LocalDate.parse(startDate).atTime(startTime, this.data.timeZone),
        end: LocalDate.parse(endDate).atTime(endTime, this.data.timeZone),
      };
    } catch {
      return null;
    }
  });
  protected readonly endBeforeStart = computed(() => {
    const range = this.range();
    return range !== null && range.end <= range.start;
  });

  protected readonly busy = signal(false);
  protected readonly error = signal<ApiError | null>(null);
  private key = newIdempotencyKey();
  private keyInput: string | null = null;

  protected async save(event?: Event): Promise<void> {
    event?.preventDefault();
    this.blockForm().markAsTouched();
    const range = this.range();
    if (this.blockForm().invalid() || !range || this.endBeforeStart() || this.busy()) return;
    const input = JSON.stringify(this.model());
    if (this.keyInput !== null && this.keyInput !== input) this.key = newIdempotencyKey();
    this.keyInput = input;
    this.busy.set(true);
    this.error.set(null);
    try {
      const { who, reason } = this.model();
      await this.store.createTimeBlock(
        { staffMemberId: who === WHOLE ? null : who, ...range, reason: reason || null },
        this.key,
      );
      this.ref.dismiss(true);
    } catch (error) {
      this.error.set(ApiError.of(error));
    } finally {
      this.busy.set(false);
    }
  }

  protected close(): void {
    this.ref.dismiss(false);
  }
}
