import { Message } from './message';

/** One page of a chat, newest first; `nextCursor` is the `before` of the older page. */
export interface MessagePage {
  readonly items: readonly Message[];
  readonly nextCursor: string | null;
}
