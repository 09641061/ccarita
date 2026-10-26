import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { LocalDate } from '../../../../shared/domain/model/local-date';
import { Avatar } from '../../../../shared/presentation/components/avatar/avatar';
import { ZonedDatePipe } from '../../../../shared/presentation/pipes/zoned-date.pipe';
import { Conversation } from '../../../domain/model/conversation';
import { conversationStatus } from '../../conversation-status';

/** One conversation of the inbox: the customer, the last activity, unread messages and what needs attention. */
@Component({
  selector: 'app-conversation-row',
  imports: [Avatar, MatIconModule, RouterLink, TranslatePipe, ZonedDatePipe],
  templateUrl: './conversation-row.html',
  styleUrl: './conversation-row.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConversationRow {
  readonly conversation = input.required<Conversation>();
  readonly timeZone = input.required<string>();
  readonly now = input.required<Date>();
  readonly selected = input(false);
  /** Member names by id, for the assignee and who paused the assistant. */
  readonly memberNames = input<ReadonlyMap<string, string>>(new Map());

  protected readonly name = computed(() => {
    const c = this.conversation();
    return c.customerDeleted ? null : (c.customerName ?? c.customerPhone);
  });
  /** A phone shown as the name gets no initials. */
  protected readonly named = computed(() => {
    const c = this.conversation();
    return !c.customerDeleted && !!c.customerName && c.customerName !== c.customerPhone;
  });
  protected readonly status = computed(() => conversationStatus(this.conversation(), this.now()));
  protected readonly when = computed<'time' | 'yesterday' | 'day'>(() => {
    const tz = this.timeZone();
    const day = LocalDate.of(this.conversation().lastMessageAt, tz);
    const today = LocalDate.of(this.now(), tz);
    if (day.equals(today)) return 'time';
    return day.equals(today.plusDays(-1)) ? 'yesterday' : 'day';
  });
  protected readonly assignee = computed(() => {
    const id = this.conversation().assignedMemberId;
    return id ? (this.memberNames().get(id) ?? null) : null;
  });
  protected readonly pausedBy = computed(() => {
    const id = this.status().memberId;
    return id ? (this.memberNames().get(id) ?? null) : null;
  });
}
