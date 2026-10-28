/**
 * The chats of one establishment that need someone, counted by pibble over the whole inbox.
 *
 * @property awaitingReply handed off (A7), or unread with nobody writing after the customer (W8)
 * @property unread chats with at least one unread message
 */
export interface InboxSummary {
  readonly awaitingReply: number;
  readonly unread: number;
}
