/** W6: free-form messages reach the customer for 24 hours after their last message. */
export const SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000;

/** What the assistant does on a conversation now (A2, A3, A7). */
export type AssistantState =
  | { readonly kind: 'active' }
  | { readonly kind: 'handedOff'; readonly summary: string | null }
  | { readonly kind: 'pausedManually'; readonly byMemberId: string | null }
  | { readonly kind: 'pausedForHuman'; readonly until: Date };

/** The chat of one customer on one establishment's line (W3), as the inbox shows it. */
export class Conversation {
  constructor(
    readonly id: string,
    readonly establishmentId: string,
    readonly customerId: string,
    /** C2: the customer's display name; `null` once customers no longer knows them. */
    readonly customerName: string | null,
    /** E.164, shown as stored and never logged; `null` once the customer is gone. */
    readonly customerPhone: string | null,
    /** C5: the customer was deleted; the chat stays and its media is removed. */
    readonly customerDeleted: boolean,
    /** W9: informative only. */
    readonly assignedMemberId: string | null,
    readonly unreadCount: number,
    readonly lastMessageAt: Date,
    readonly lastInboundAt: Date | null,
    readonly assistantPausedUntil: Date | null,
    readonly assistantHandedOff: boolean,
    readonly handoffSummary: string | null,
    readonly assistantPausedManually: boolean,
    readonly assistantPausedByMemberId: string | null,
  ) {}

  /** W6: when free-form messages stop reaching the customer; `null` before they ever wrote. */
  get windowClosesAt(): Date | null {
    return this.lastInboundAt ? new Date(this.lastInboundAt.getTime() + SERVICE_WINDOW_MS) : null;
  }

  /** W6: staff may write free text until 24 hours after the customer's last message. */
  windowOpen(now: Date): boolean {
    const closes = this.windowClosesAt;
    return closes !== null && now < closes;
  }

  /** W6, O6, C5: a free-form reply can be sent now; pibble still decides (`WINDOW_CLOSED`, `PLAN_INACTIVE`). */
  canReply(now: Date, planActive: boolean): boolean {
    return planActive && !this.customerDeleted && this.windowOpen(now);
  }

  /** A7 wins over a manual pause, which wins over the 12-hour pause after a human message (A3). */
  assistantState(now: Date): AssistantState {
    if (this.assistantHandedOff) return { kind: 'handedOff', summary: this.handoffSummary };
    if (this.assistantPausedManually)
      return { kind: 'pausedManually', byMemberId: this.assistantPausedByMemberId };
    if (this.assistantPausedUntil && now < this.assistantPausedUntil)
      return { kind: 'pausedForHuman', until: this.assistantPausedUntil };
    return { kind: 'active' };
  }

  /** A7: the assistant handed the customer to a person, who has not resumed it yet. */
  get needsSomeone(): boolean {
    return this.assistantHandedOff;
  }

  /** The same conversation after it was opened (W8). */
  read(): Conversation {
    return Object.assign(Object.create(Conversation.prototype) as Conversation, this, {
      unreadCount: 0,
    });
  }
}
