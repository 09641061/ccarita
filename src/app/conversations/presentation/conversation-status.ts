import { Conversation } from '../domain/model/conversation';

/** The one line a conversation shows under its name: what needs attention first. */
export interface ConversationStatus {
  /** Under `conversations.status`. */
  readonly key:
    | 'mediaRemoved'
    | 'handedOff'
    | 'pausedManually'
    | 'pausedForHuman'
    | 'windowClosed'
    | 'windowOpen';
  readonly icon: string;
  readonly warning: boolean;
  /** The time a pause or the window ends, for `pausedForHuman` and `windowOpen`. */
  readonly until: Date | null;
  /** Who paused the assistant, for `pausedManually`. */
  readonly memberId: string | null;
}

/**
 * C5, A7, A3, W6 in that order. pibble sends no message preview and does not say whether the assistant is on,
 * so the line names the state instead.
 */
export function conversationStatus(conversation: Conversation, now: Date): ConversationStatus {
  const base = { warning: false, until: null, memberId: null };
  if (conversation.customerDeleted) return { ...base, key: 'mediaRemoved', icon: 'folder_off' };
  const assistant = conversation.assistantState(now);
  if (assistant.kind === 'handedOff')
    return { ...base, key: 'handedOff', icon: 'support_agent', warning: true };
  if (assistant.kind === 'pausedManually')
    return { ...base, key: 'pausedManually', icon: 'pause_circle', memberId: assistant.byMemberId };
  if (assistant.kind === 'pausedForHuman')
    return { ...base, key: 'pausedForHuman', icon: 'pause_circle', until: assistant.until };
  if (!conversation.windowOpen(now)) return { ...base, key: 'windowClosed', icon: 'lock_clock' };
  return { ...base, key: 'windowOpen', icon: 'schedule', until: conversation.windowClosesAt };
}
