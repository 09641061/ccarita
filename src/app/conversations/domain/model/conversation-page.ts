import { Conversation } from './conversation';

/** One page of an establishment's inbox, newest activity first (W7); `nextCursor` asks for the next one. */
export interface ConversationPage {
  readonly items: readonly Conversation[];
  readonly nextCursor: string | null;
}
