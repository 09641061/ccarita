import type {
  Message as MessageResource,
  MessagePage as MessagePageResource,
} from '../../shared/infrastructure/api/pibble.schema';
import { required } from '../../shared/infrastructure/api/required';
import {
  DeliveryStatus,
  MediaStatus,
  Message,
  MessageChoices,
  MessageKind,
  MessageOrigin,
} from '../domain/model/message';
import { MessagePage } from '../domain/model/message-page';

export function toMessage(resource: MessageResource): Message {
  const titles = resource.choices ?? [];
  const choices: MessageChoices | null =
    resource.choicesStyle && titles.length > 0
      ? { style: resource.choicesStyle as MessageChoices['style'], titles }
      : null;
  return new Message(
    required(resource.id, 'Message.id'),
    required(resource.conversationId, 'Message.conversationId'),
    required(resource.direction, 'Message.direction') as Message['direction'],
    required(resource.origin, 'Message.origin') as MessageOrigin,
    required(resource.kind, 'Message.kind') as MessageKind,
    resource.body ?? null,
    resource.hasMedia ?? false,
    resource.mediaMime ?? null,
    (resource.mediaStatus as MediaStatus | undefined) ?? null,
    resource.templateName ?? null,
    required(resource.status, 'Message.status') as DeliveryStatus,
    resource.sentByMemberId ?? null,
    choices,
    new Date(required(resource.occurredAt, 'Message.occurredAt')),
  );
}

export function toMessagePage(resource: MessagePageResource): MessagePage {
  return { items: (resource.items ?? []).map(toMessage), nextCursor: resource.nextCursor ?? null };
}
