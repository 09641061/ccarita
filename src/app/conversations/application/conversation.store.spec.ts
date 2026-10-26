import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { conversationResource, messageResource } from '../../../testing/conversation-fixtures';
import { settle } from '../../../testing/settle';
import { API_BASE_URL } from '../../shared/infrastructure/http/api-base-url';
import { apiErrorInterceptor } from '../../shared/infrastructure/http/api-error.interceptor';
import { idempotencyInterceptor } from '../../shared/infrastructure/http/idempotency';
import { Conversation } from '../domain/model/conversation';
import { CHAT_PAGE_SIZE, ConversationStore } from './conversation.store';
import { InboxStore } from './inbox.store';

const API = 'http://api.test';
const CONVERSATION = `${API}/api/v1/conversations/c-1`;
const MESSAGES = `${CONVERSATION}/messages`;

describe('ConversationStore', () => {
  let backend: HttpTestingController;
  let store: ConversationStore;
  let changed: Subject<string>;
  let reconnected: Subject<void>;
  let upserted: Conversation[];

  beforeEach(() => {
    changed = new Subject();
    reconnected = new Subject();
    upserted = [];
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([idempotencyInterceptor, apiErrorInterceptor])),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: API },
        {
          provide: InboxStore,
          useValue: {
            changed$: changed,
            reconnected$: reconnected,
            upsert: (c: Conversation) => upserted.push(c),
          },
        },
      ],
    });
    backend = TestBed.inject(HttpTestingController);
    store = TestBed.inject(ConversationStore);
  });

  afterEach(() => backend.verify());

  async function open(unreadCount = 0, nextCursor?: string) {
    store.open('c-1');
    TestBed.tick();
    await settle();
    backend.expectOne(CONVERSATION).flush(conversationResource('c-1', { unreadCount }));
    const latest = backend.expectOne((r) => r.url === MESSAGES && !r.params.has('before'));
    expect(latest.request.params.get('size')).toBe(String(CHAT_PAGE_SIZE));
    latest.flush({
      items: [
        messageResource('m-2', { occurredAt: '2026-10-24T14:00:00Z' }),
        messageResource('m-1', { occurredAt: '2026-10-24T13:00:00Z' }),
      ],
      nextCursor,
    });
    await settle();
    TestBed.tick();
  }

  it('W8: marks the conversation read when it opens with unread messages', async () => {
    await open(3);
    const read = backend.expectOne(`${CONVERSATION}/read`);
    expect(upserted[0].unreadCount).toBe(0);
    read.flush(conversationResource('c-1', { unreadCount: 0 }));
    await settle();
    TestBed.tick();
    expect(store.conversation.value()!.unreadCount).toBe(0);
    backend.expectNone(`${CONVERSATION}/read`);
    expect(store.messages()!.map((m) => m.id)).toEqual(['m-1', 'm-2']);
  });

  it('does not mark a read conversation again', async () => {
    await open(0);
    backend.expectNone(`${CONVERSATION}/read`);
  });

  it('reads older pages with the cursor and puts them first', async () => {
    await open(0, 'cur-1');
    expect(store.hasOlder()).toBe(true);
    const loading = store.loadOlder();
    const older = backend.expectOne(
      (r) => r.url === MESSAGES && r.params.get('before') === 'cur-1',
    );
    older.flush({ items: [messageResource('m-0', { occurredAt: '2026-10-23T13:00:00Z' })] });
    await loading;
    expect(store.messages()!.map((m) => m.id)).toEqual(['m-0', 'm-1', 'm-2']);
    expect(store.hasOlder()).toBe(false);
  });

  it('shows a sent reply at once and reloads the conversation', async () => {
    await open();
    const sending = store.send('Sí, a las 4', 'k-1');
    const post = backend.expectOne((r) => r.method === 'POST' && r.url === MESSAGES);
    expect(post.request.headers.get('Idempotency-Key')).toBe('k-1');
    post.flush(
      messageResource('m-3', {
        direction: 'out',
        origin: 'staff',
        status: 'pending',
        occurredAt: '2026-10-24T14:05:00Z',
      }),
    );
    await sending;
    expect(store.messages()!.map((m) => m.id)).toEqual(['m-1', 'm-2', 'm-3']);
    TestBed.tick();
    backend.expectOne(CONVERSATION).flush(conversationResource('c-1', { unreadCount: 0 }));
  });

  it('W10: reloads the open chat when the stream says it changed, keeping the newest version', async () => {
    await open();
    changed.next('c-other');
    TestBed.tick();
    backend.expectNone(CONVERSATION);

    changed.next('c-1');
    TestBed.tick();
    backend.expectOne(CONVERSATION).flush(conversationResource('c-1', { unreadCount: 0 }));
    backend
      .expectOne((r) => r.url === MESSAGES)
      .flush({
        items: [messageResource('m-2', { direction: 'out', status: 'read' })],
      });
    await settle();
    expect(store.messages()!.find((m) => m.id === 'm-2')!.status).toBe('read');

    reconnected.next();
    TestBed.tick();
    backend.expectOne(CONVERSATION).flush(conversationResource('c-1', { unreadCount: 0 }));
    backend.expectOne((r) => r.url === MESSAGES).flush({ items: [] });
  });
});
