import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { conversation } from '../../../../../testing/conversation-fixtures';
import { fakeResource } from '../../../../../testing/fake-resource';
import { provideSpanish } from '../../../../../testing/provide-spanish';
import {
  CurrentEstablishment,
  CurrentOrganization,
  EstablishmentTeam,
} from '../../../../organization/public-api';
import { ApiError } from '../../../../shared/domain/model/api-error';
import { ConversationStore } from '../../../application/conversation.store';
import { InboxFilter, InboxStore, StreamState } from '../../../application/inbox.store';
import { Conversation } from '../../../domain/model/conversation';
import { WhatsappLine } from '../../../domain/model/whatsapp-line';
import { Inbox } from './inbox';

const NOW = new Date('2026-10-24T15:00:00Z');
const LINE = new WhatsappLine('l-1', 'est-1', '+51 900 000 000', 'coexistence', true, {});

describe('Inbox', () => {
  let store: ReturnType<typeof fakeStore>;
  const role = signal<'owner' | 'staff'>('owner');

  function fakeStore(items: Conversation[] | null) {
    const conversations = signal<readonly Conversation[] | null>(items);
    const filter = signal<InboxFilter>('all');
    return {
      filter,
      streamState: signal<StreamState>('live'),
      firstPage: fakeResource(items ? { items, nextCursor: null } : undefined),
      line: fakeResource<WhatsappLine>(LINE),
      conversations,
      visible: computed(() =>
        (conversations() ?? []).filter((c) => filter() !== 'unread' || c.unreadCount > 0),
      ),
      needingSomeone: computed(() => (conversations() ?? []).filter((c) => c.needsSomeone).length),
      hasMore: signal(false),
      loadingMore: signal(false),
      loadMore: vi.fn(),
      stop: vi.fn(),
      follow: vi.fn(),
    };
  }

  async function render(items: Conversation[] | null) {
    vi.useFakeTimers({ toFake: ['Date'], now: NOW });
    store = fakeStore(items);
    store.follow.mockReturnValue(store.stop);
    TestBed.configureTestingModule({
      providers: [
        provideSpanish(),
        provideRouter(
          [
            { path: 'mensajes', component: Inbox },
            { path: '**', children: [] },
          ],
          withComponentInputBinding(),
        ),
        { provide: InboxStore, useValue: store },
        { provide: ConversationStore, useValue: { openedId: signal(null) } },
        {
          provide: CurrentOrganization,
          useValue: { can: () => role() === 'owner' },
        },
        {
          provide: CurrentEstablishment,
          useValue: {
            id: signal('est-1'),
            timeZone: signal('America/Lima'),
            list: fakeResource([{}]),
            establishments: signal([{}]),
          },
        },
        { provide: EstablishmentTeam, useValue: { membersById: signal(new Map()) } },
      ],
    });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/mensajes');
    await harness.fixture.whenStable();
    const host = harness.routeNativeElement as HTMLElement;
    return { harness, host, stable: () => harness.fixture.whenStable() };
  }

  beforeEach(() => role.set('owner'));
  afterEach(() => vi.useRealTimers());

  const text = (host: HTMLElement) => host.textContent!.replace(/\s+/g, ' ');

  it('follows the stream while open and lists conversations with their state', async () => {
    const { host, harness } = await render([
      conversation({ id: 'c-1', assistantHandedOff: true }),
      conversation({
        id: 'c-2',
        customerDeleted: true,
        customerName: null,
        unreadCount: 0,
        lastMessageAt: new Date('2026-10-18T15:00:00Z'),
      }),
      conversation({
        id: 'c-3',
        customerName: 'Diego Salazar',
        unreadCount: 0,
        assistantPausedUntil: new Date('2026-10-25T02:15:00Z'),
        lastMessageAt: new Date('2026-10-23T20:00:00Z'),
      }),
    ]);
    expect(store.follow).toHaveBeenCalledTimes(1);
    const rows = [...host.querySelectorAll('app-conversation-row')].map((r) =>
      r.textContent!.replace(/\s+/g, ' '),
    );
    expect(rows[0]).toContain('Rosa Huamán');
    expect(rows[0]).toContain('09:00');
    expect(rows[0]).toContain('Necesita a una persona');
    expect(rows[0]).toContain('2 sin leer');
    expect(rows[1]).toContain('Cliente eliminado');
    expect(rows[1]).toContain('Archivos borrados al eliminar al cliente');
    expect(rows[2]).toContain('ayer');
    expect(rows[2]).toContain('Asistente pausado hasta las 21:15');
    expect(text(host)).toContain('Necesitan a alguien · 1');
    expect(text(host)).toContain('En vivo');
    expect(host.querySelector('a[href="/mensajes/c-1"]')).not.toBeNull();

    await harness.navigateByUrl('/otra');
    expect(store.stop).toHaveBeenCalled();
  });

  it('filters the loaded conversations', async () => {
    const { host, stable } = await render([
      conversation({ id: 'c-1' }),
      conversation({ id: 'c-2', unreadCount: 0 }),
    ]);
    [...host.querySelectorAll<HTMLButtonElement>('.chip')]
      .find((b) => b.textContent!.includes('Sin leer'))!
      .click();
    await stable();
    expect(store.filter()).toBe('unread');
    expect(host.querySelectorAll('app-conversation-row')).toHaveLength(1);
  });

  it('says the stream is reconnecting without hiding the list', async () => {
    const { host, stable } = await render([conversation()]);
    store.streamState.set('offline');
    await stable();
    expect(text(host)).toContain('Reconectando');
    expect(host.querySelectorAll('app-conversation-row')).toHaveLength(1);
  });

  it('W1: points the owner to the settings when the establishment has no line', async () => {
    const { host, stable } = await render([]);
    store.line.error.set(new ApiError(404, 'WHATSAPP_LINE_NOT_FOUND', 'x'));
    await stable();
    expect(text(host)).toContain('Este local aún no tiene WhatsApp');
    expect(host.querySelector('a[href$="?ajustes=whatsapp"]')).not.toBeNull();
  });

  it('W1: asks staff to wait for the owner', async () => {
    role.set('staff');
    const { host, stable } = await render([]);
    store.line.error.set(new ApiError(404, 'WHATSAPP_LINE_NOT_FOUND', 'x'));
    await stable();
    expect(text(host)).toContain('Cuando el dueño conecte el número');
    expect(host.querySelector('a[href$="?ajustes=whatsapp"]')).toBeNull();
  });

  it('warns about a disconnected line', async () => {
    const { host, stable } = await render([conversation()]);
    store.line.set(new WhatsappLine('l-1', 'est-1', '+51 900 000 000', 'coexistence', false, {}));
    await stable();
    expect(text(host)).toContain('La línea +51 900 000 000 está desconectada');
  });

  it('shows an empty inbox, and offline and forbidden loads', async () => {
    const { host, stable } = await render([]);
    expect(text(host)).toContain('Aún no hay conversaciones');
    store.firstPage.error.set(new ApiError(0, 'NETWORK_ERROR', 'x'));
    await stable();
    expect(text(host)).toContain('No hay conexión');
    store.firstPage.error.set(new ApiError(403, 'ACCESS_DENIED', 'x'));
    await stable();
    expect(text(host)).toContain('no está disponible para tu rol');
  });

  it('loads more on request', async () => {
    const { host, stable } = await render([conversation()]);
    store.hasMore.set(true);
    await stable();
    [...host.querySelectorAll('button')]
      .find((b) => b.textContent!.includes('Cargar más'))!
      .click();
    expect(store.loadMore).toHaveBeenCalled();
  });
});
