import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { conversationResource } from '../../../testing/conversation-fixtures';
import { settle } from '../../../testing/settle';
import { CurrentEstablishment, CurrentOrganization } from '../../organization/public-api';
import { ApiError } from '../../shared/domain/model/api-error';
import { API_BASE_URL } from '../../shared/infrastructure/http/api-base-url';
import { apiErrorInterceptor } from '../../shared/infrastructure/http/api-error.interceptor';
import { InboxChange } from '../domain/model/inbox-change';
import { InboxStreamApi } from '../infrastructure/inbox-stream.api';
import {
  AppointmentEvent,
  INBOX_PAGE_SIZE,
  InboxStore,
  STREAM_SILENCE_MS,
  SUMMARY_DEBOUNCE_MS,
  TYPING_TIMEOUT_MS,
  reconnectDelay,
} from './inbox.store';

const API = 'http://api.test';
const LIST = `${API}/api/v1/establishments/est-1/conversations`;
const SUMMARY = `${API}/api/v1/inbox/summary`;

describe('InboxStore', () => {
  let backend: HttpTestingController;
  let store: InboxStore;
  let connections: Subject<InboxChange>[];
  const organizationId = signal<string | null>('org-1');
  const establishmentId = signal<string | null>('est-1');

  beforeEach(() => {
    connections = [];
    organizationId.set('org-1');
    establishmentId.set('est-1');
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiErrorInterceptor])),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: API },
        { provide: CurrentEstablishment, useValue: { id: establishmentId } },
        {
          provide: CurrentOrganization,
          useValue: {
            selected: () => (organizationId() ? { id: organizationId() } : null),
            memberId: signal('m-1'),
          },
        },
        {
          provide: InboxStreamApi,
          useValue: {
            follow: () => {
              const connection = new Subject<InboxChange>();
              connections.push(connection);
              return connection;
            },
          },
        },
      ],
    });
    backend = TestBed.inject(HttpTestingController);
    store = TestBed.inject(InboxStore);
  });

  afterEach(() => {
    vi.useRealTimers();
    backend.match((r) => r.url === SUMMARY);
    backend.verify();
  });

  async function flushFirstPage(items: object[], nextCursor?: string) {
    TestBed.tick();
    await settle();
    const request = backend.expectOne((r) => r.url === LIST && !r.params.has('cursor'));
    expect(request.request.params.get('size')).toBe(String(INBOX_PAGE_SIZE));
    request.flush({ items, nextCursor });
    backend.match(`${API}/api/v1/establishments/est-1/whatsapp-line`);
    await settle();
  }

  it('loads more pages and keeps each conversation once, newest activity first', async () => {
    await flushFirstPage(
      [
        conversationResource('c-2', { lastMessageAt: '2026-10-24T14:00:00Z' }),
        conversationResource('c-1', { lastMessageAt: '2026-10-24T13:00:00Z' }),
      ],
      'cur-1',
    );
    expect(store.hasMore()).toBe(true);

    const more = store.loadMore();
    const next = backend.expectOne((r) => r.url === LIST && r.params.get('cursor') === 'cur-1');
    next.flush({
      items: [
        conversationResource('c-1', { lastMessageAt: '2026-10-24T13:00:00Z' }),
        conversationResource('c-0', { lastMessageAt: '2026-10-23T13:00:00Z' }),
      ],
    });
    await more;
    expect(store.conversations()!.map((c) => c.id)).toEqual(['c-2', 'c-1', 'c-0']);
    expect(store.hasMore()).toBe(false);
  });

  it('filters the loaded conversations', async () => {
    await flushFirstPage([
      conversationResource('c-1', { assistantHandedOff: true, unreadCount: 0 }),
      conversationResource('c-2', { assignedMemberId: 'm-1' }),
      conversationResource('c-3', { unreadCount: 0 }),
    ]);
    expect(store.needingSomeone()).toBe(1);
    const shown = () => store.visible().map((c) => c.id);
    store.filter.set('needsSomeone');
    expect(shown()).toEqual(['c-1']);
    store.filter.set('unread');
    expect(shown()).toEqual(['c-2']);
    store.filter.set('mine');
    expect(shown()).toEqual(['c-2']);
  });

  it('W3: finds a customer’s conversation among the loaded pages', async () => {
    await flushFirstPage([
      conversationResource('c-1', { customerId: 'cu-1' }),
      conversationResource('c-2', { customerId: 'cu-2' }),
    ]);
    expect(store.conversationOf('cu-2')).toBe('c-2');
    expect(store.conversationOf('cu-9')).toBeNull();
  });

  it('reloads a changed conversation of the establishment and ignores other establishments', async () => {
    await flushFirstPage([
      conversationResource('c-1', { lastMessageAt: '2026-10-24T14:00:00Z' }),
      conversationResource('c-2', { lastMessageAt: '2026-10-24T13:00:00Z' }),
    ]);
    const changed: string[] = [];
    store.changed$.subscribe((id) => changed.push(id));
    store.follow();
    TestBed.tick();
    expect(store.streamState()).toBe('connecting');
    connections[0].next({ type: 'ping' });
    expect(store.streamState()).toBe('live');

    connections[0].next({
      type: 'conversation',
      conversationId: 'c-9',
      establishmentId: 'est-2',
      summary: null,
    });
    backend.expectNone(`${API}/api/v1/conversations/c-9`);

    connections[0].next({
      type: 'conversation',
      conversationId: 'c-2',
      establishmentId: 'est-1',
      summary: null,
    });
    backend
      .expectOne(`${API}/api/v1/conversations/c-2`)
      .flush(
        conversationResource('c-2', { lastMessageAt: '2026-10-24T15:00:00Z', unreadCount: 5 }),
      );
    expect(changed).toEqual(['c-2']);
    expect(store.conversations()!.map((c) => [c.id, c.unreadCount])).toEqual([
      ['c-2', 5],
      ['c-1', 2],
    ]);
  });

  it('updates a loaded row from the stream’s summary without asking pibble', async () => {
    await flushFirstPage([
      conversationResource('c-1', { lastMessageAt: '2026-10-24T14:00:00Z' }),
      conversationResource('c-2', {
        lastMessageAt: '2026-10-24T13:00:00Z',
        assistantPausedManually: true,
        assistantPausedByMemberId: 'm-2',
      }),
    ]);
    store.follow();
    TestBed.tick();
    connections[0].next({ type: 'ping' });

    connections[0].next({
      type: 'conversation',
      conversationId: 'c-2',
      establishmentId: 'est-1',
      summary: {
        lastMessageAt: new Date('2026-10-24T15:00:00Z'),
        lastInboundAt: new Date('2026-10-24T15:00:00Z'),
        unreadCount: 3,
        windowClosesAt: new Date('2026-10-25T15:00:00Z'),
        assistantPausedUntil: null,
        assistantHandedOff: false,
        assistantPausedManually: false,
      },
    });

    backend.expectNone(`${API}/api/v1/conversations/c-2`);
    const [first] = store.conversations()!;
    expect([first.id, first.unreadCount, first.awaitsReply]).toEqual(['c-2', 3, true]);
    expect(first.windowClosesAt).toEqual(new Date('2026-10-25T15:00:00Z'));
    expect(first.assistantPausedByMemberId).toBeNull();
    expect(first.customerName).toBe('Rosa Huamán');
  });

  it('marks Mensajes from pibble’s count of the whole inbox, asked again after changes', async () => {
    await flushFirstPage([conversationResource('c-1', { unreadCount: 0 })]);
    const summary = backend.expectOne((r) => r.url === SUMMARY);
    expect(summary.request.params.get('establishmentId')).toBe('est-1');
    summary.flush({ awaitingReply: 1, unread: 4 });
    await settle();
    expect(store.awaitingReply()).toBe(true);

    vi.useFakeTimers();
    store.follow();
    TestBed.tick();
    connections[0].next({ type: 'ping' });
    for (const id of ['c-1', 'c-1', 'c-1'])
      connections[0].next({
        type: 'conversation',
        conversationId: id,
        establishmentId: 'est-1',
        summary: null,
      });
    backend.match(`${API}/api/v1/conversations/c-1`);
    vi.advanceTimersByTime(SUMMARY_DEBOUNCE_MS);
    TestBed.tick();
    const again = backend.expectOne((r) => r.url === SUMMARY);
    vi.useRealTimers();
    again.flush({ awaitingReply: 0, unread: 0 });
    await settle();
    expect(store.awaitingReply()).toBe(false);
  });

  it('shows the assistant typing until it stops, someone writes after the customer, or a minute passes', async () => {
    await flushFirstPage([conversationResource('c-1')]);
    vi.useFakeTimers();
    store.follow();
    TestBed.tick();
    connections[0].next({ type: 'ping' });
    const typing = (on: boolean, id = 'c-1') =>
      connections[0].next({
        type: 'assistant',
        conversationId: id,
        establishmentId: 'est-1',
        typing: on,
      });

    typing(true);
    expect(store.typing().has('c-1')).toBe(true);
    typing(false);
    expect(store.typing().has('c-1')).toBe(false);

    typing(true);
    connections[0].next({
      type: 'conversation',
      conversationId: 'c-1',
      establishmentId: 'est-1',
      summary: {
        lastMessageAt: new Date('2026-10-24T14:00:05Z'),
        lastInboundAt: new Date('2026-10-24T14:00:00Z'),
        unreadCount: 2,
        windowClosesAt: new Date('2026-10-25T14:00:00Z'),
        assistantPausedUntil: null,
        assistantHandedOff: false,
        assistantPausedManually: false,
      },
    });
    expect(store.typing().has('c-1')).toBe(false);

    typing(true);
    vi.advanceTimersByTime(TYPING_TIMEOUT_MS);
    expect(store.typing().has('c-1')).toBe(false);
  });

  it('passes on appointment changes of every establishment', async () => {
    await flushFirstPage([]);
    const seen: AppointmentEvent[] = [];
    store.appointmentChanged$.subscribe((change) => seen.push(change));
    store.follow();
    TestBed.tick();
    connections[0].next({
      type: 'appointment',
      appointmentId: 'a-1',
      establishmentId: 'est-2',
      change: 'booked',
    });
    expect(seen).toEqual([
      { type: 'appointment', appointmentId: 'a-1', establishmentId: 'est-2', change: 'booked' },
    ]);
  });

  it('reconnects with backoff after a drop, then reloads the first page', async () => {
    await flushFirstPage([conversationResource('c-1')]);
    vi.useFakeTimers();
    let reconnected = 0;
    store.reconnected$.subscribe(() => reconnected++);
    store.follow();
    TestBed.tick();
    connections[0].next({ type: 'ping' });

    connections[0].error(new ApiError(0, 'NETWORK_ERROR', 'closed'));
    expect(store.streamState()).toBe('offline');
    vi.advanceTimersByTime(reconnectDelay(1) - 1);
    expect(connections).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(connections).toHaveLength(2);

    connections[1].error(new ApiError(0, 'NETWORK_ERROR', 'down'));
    vi.advanceTimersByTime(reconnectDelay(2));
    expect(connections).toHaveLength(3);
    expect(reconnected).toBe(0);

    connections[2].next({ type: 'ping' });
    expect(store.streamState()).toBe('live');
    expect(reconnected).toBe(1);
    TestBed.tick();
    backend.expectOne((r) => r.url === LIST).flush({ items: [] });
  });

  it('reconnects a stream that stays silent for a minute', async () => {
    await flushFirstPage([]);
    vi.useFakeTimers();
    store.follow();
    TestBed.tick();
    connections[0].next({ type: 'ping' });
    vi.advanceTimersByTime(STREAM_SILENCE_MS);
    expect(store.streamState()).toBe('offline');
    vi.advanceTimersByTime(reconnectDelay(1));
    expect(connections).toHaveLength(2);
    expect(connections[0].observed).toBe(false);
  });

  it('follows while someone does, and restarts with the organization', async () => {
    await flushFirstPage([]);
    const stopFirst = store.follow();
    const stopSecond = store.follow();
    TestBed.tick();
    expect(connections).toHaveLength(1);

    organizationId.set('org-2');
    TestBed.tick();
    expect(connections).toHaveLength(2);
    expect(connections[0].observed).toBe(false);

    organizationId.set(null);
    TestBed.tick();
    expect(connections[1].observed).toBe(false);
    organizationId.set('org-2');
    TestBed.tick();

    stopFirst();
    stopFirst();
    expect(connections[2].observed).toBe(true);
    stopSecond();
    expect(connections[2].observed).toBe(false);
    expect(store.streamState()).toBe('idle');
  });
});
