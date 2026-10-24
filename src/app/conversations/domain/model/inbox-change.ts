/**
 * An event of the inbox stream: `ping` once subscribed and every 25 seconds, `conversation` when one changed in an
 * establishment the member sees (W7).
 */
export type InboxChange =
  | { readonly type: 'ping' }
  | {
      readonly type: 'conversation';
      readonly conversationId: string;
      readonly establishmentId: string;
    };
