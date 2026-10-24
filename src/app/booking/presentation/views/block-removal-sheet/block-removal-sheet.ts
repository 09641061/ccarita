import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MAT_BOTTOM_SHEET_DATA, MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { MatButtonModule } from '@angular/material/button';
import { TranslatePipe } from '@ngx-translate/core';
import { ApiError } from '../../../../shared/domain/model/api-error';
import { BusyButton } from '../../../../shared/presentation/components/busy-button/busy-button';
import { ErrorMessagePipe } from '../../../../shared/presentation/pipes/error-message.pipe';
import { ZonedDatePipe } from '../../../../shared/presentation/pipes/zoned-date.pipe';
import { CalendarStore } from '../../../application/calendar.store';
import { BlockEntry } from '../../calendar-entries';

export interface BlockRemovalSheetData {
  readonly entry: BlockEntry;
  readonly timeZone: string;
}

/** Confirms removing a time block (B15), which frees its time for booking again. */
@Component({
  selector: 'app-block-removal-sheet',
  imports: [BusyButton, ErrorMessagePipe, MatButtonModule, TranslatePipe, ZonedDatePipe],
  template: `
    @let block = data.entry.block;
    <div class="sheet">
      <header>
        <h2 id="block-removal-title">{{ 'booking.block.removeTitle' | translate }}</h2>
        <p class="muted">
          {{ data.entry.memberName ?? ('booking.block.whole' | translate) }} ·
          {{
            'booking.block.removeMessage'
              | translate
                : {
                    when:
                      (block.start | zonedDate: data.timeZone : 'dayTime') +
                      ' – ' +
                      (block.end | zonedDate: data.timeZone : 'dayTime'),
                  }
          }}
        </p>
      </header>
      @if (error(); as e) {
        <p class="field-error" role="alert">{{ e | errorMessage }}</p>
      }
      <div class="actions">
        <button matButton type="button" (click)="ref.dismiss(false)">
          {{ 'booking.block.keep' | translate }}
        </button>
        <app-busy-button [busy]="busy()" (pressed)="remove()">
          {{ (busy() ? 'booking.block.removing' : 'booking.block.remove') | translate }}
        </app-busy-button>
      </div>
    </div>
  `,
  styleUrl: '../sheet.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BlockRemovalSheet {
  private readonly store = inject(CalendarStore);
  protected readonly ref = inject(MatBottomSheetRef<BlockRemovalSheet>);
  protected readonly data = inject<BlockRemovalSheetData>(MAT_BOTTOM_SHEET_DATA);
  protected readonly busy = signal(false);
  protected readonly error = signal<ApiError | null>(null);

  protected async remove(): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    try {
      await this.store.deleteTimeBlock(this.data.entry.block);
      this.ref.dismiss(true);
    } catch (error) {
      this.error.set(ApiError.of(error));
    } finally {
      this.busy.set(false);
    }
  }
}
