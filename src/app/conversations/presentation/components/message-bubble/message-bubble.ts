import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe } from '@ngx-translate/core';
import { DeliveryStatus } from '../../../../shared/presentation/components/delivery-status/delivery-status';
import { MessageOrigin } from '../../../../shared/presentation/components/message-origin/message-origin';
import { ZonedDatePipe } from '../../../../shared/presentation/pipes/zoned-date.pipe';
import { Message } from '../../../domain/model/message';

/**
 * One message: the customer's on the left, the business's on the right, the assistant's signed "Tako" with the
 * mark. Outbound messages show their delivery (W10); a file goes in the projected content.
 */
@Component({
  selector: 'app-message-bubble',
  imports: [DeliveryStatus, MatIconModule, MessageOrigin, TranslatePipe, ZonedDatePipe],
  templateUrl: './message-bubble.html',
  styleUrl: './message-bubble.scss',
  host: {
    '[class.out]': 'message().outbound',
    '[class.assistant]': "message().origin === 'assistant'",
    '[class.failed]': 'message().failed',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MessageBubble {
  readonly message = input.required<Message>();
  readonly timeZone = input.required<string>();
  /** The team member who sent a `staff` message. */
  readonly memberName = input<string>();

  /** The customer is named by the chat; everyone else signs. */
  protected readonly signed = computed(() => this.message().origin !== 'customer');
  /** A file's caption, or a text; kinds without either name themselves. */
  protected readonly placeholder = computed(() => {
    const m = this.message();
    if (m.body || m.carriesMedia) return null;
    return m.kind === 'location' || m.kind === 'reaction' ? m.kind : 'unsupported';
  });
}
