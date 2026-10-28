import type {
  Conversation as ConversationResource,
  ConversationPage as ConversationPageResource,
} from '../../shared/infrastructure/api/pibble.schema';
import { required } from '../../shared/infrastructure/api/required';
import { Conversation } from '../domain/model/conversation';
import { ConversationPage } from '../domain/model/conversation-page';

const instant = (value: string | undefined) => (value ? new Date(value) : null);

export function toConversation(resource: ConversationResource): Conversation {
  return new Conversation(
    required(resource.id, 'Conversation.id'),
    required(resource.establishmentId, 'Conversation.establishmentId'),
    required(resource.customerId, 'Conversation.customerId'),
    resource.customerName ?? null,
    resource.customerPhone ?? null,
    resource.customerDeleted ?? false,
    resource.assignedMemberId ?? null,
    resource.unreadCount ?? 0,
    new Date(required(resource.lastMessageAt, 'Conversation.lastMessageAt')),
    instant(resource.lastInboundAt),
    instant(resource.assistantPausedUntil),
    resource.assistantHandedOff ?? false,
    resource.handoffSummary ?? null,
    resource.assistantPausedManually ?? false,
    resource.assistantPausedByMemberId ?? null,
    instant(resource.windowClosesAt),
  );
}

export function toConversationPage(resource: ConversationPageResource): ConversationPage {
  return {
    items: (resource.items ?? []).map(toConversation),
    nextCursor: resource.nextCursor ?? null,
  };
}
