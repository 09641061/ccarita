import { Conversation } from '../app/conversations/domain/model/conversation';
import { Message } from '../app/conversations/domain/model/message';

/** pibble-shaped resources and domain objects for conversations tests. */
export function conversationResource(id = 'c-1', overrides: Record<string, unknown> = {}) {
  return {
    id,
    establishmentId: 'est-1',
    customerId: 'cu-1',
    customerName: 'Rosa Huamán',
    customerPhone: '+51987654321',
    customerDeleted: false,
    unreadCount: 2,
    lastMessageAt: '2026-10-24T14:00:00Z',
    lastInboundAt: '2026-10-24T14:00:00Z',
    windowOpen: true,
    windowClosesAt: '2026-10-25T14:00:00Z',
    assistantPaused: false,
    assistantHandedOff: false,
    assistantPausedManually: false,
    ...overrides,
  };
}

export function messageResource(id = 'm-1', overrides: Record<string, unknown> = {}) {
  return {
    id,
    conversationId: 'c-1',
    direction: 'in',
    origin: 'customer',
    kind: 'text',
    body: 'Hola, ¿tienen cita mañana?',
    hasMedia: false,
    status: 'received',
    choices: [],
    occurredAt: '2026-10-24T14:00:00Z',
    ...overrides,
  };
}

type Fields<T> = Partial<{ -readonly [K in keyof T]: T[K] }>;

export function conversation(overrides: Fields<Conversation> = {}): Conversation {
  const c = new Conversation(
    'c-1',
    'est-1',
    'cu-1',
    'Rosa Huamán',
    '+51987654321',
    false,
    null,
    2,
    new Date('2026-10-24T14:00:00Z'),
    new Date('2026-10-24T14:00:00Z'),
    null,
    false,
    null,
    false,
    null,
  );
  return Object.assign(c, overrides);
}

export function message(overrides: Fields<Message> = {}): Message {
  const m = new Message(
    'm-1',
    'c-1',
    'in',
    'customer',
    'text',
    'Hola, ¿tienen cita mañana?',
    false,
    null,
    null,
    null,
    'received',
    null,
    null,
    new Date('2026-10-24T14:00:00Z'),
  );
  return Object.assign(m, overrides);
}
