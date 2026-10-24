import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { conversationResource, messageResource } from '../../../testing/conversation-fixtures';
import { API_BASE_URL } from '../../shared/infrastructure/http/api-base-url';
import { apiErrorInterceptor } from '../../shared/infrastructure/http/api-error.interceptor';
import { idempotencyInterceptor } from '../../shared/infrastructure/http/idempotency';
import { ConversationsApi } from './conversations.api';
import { MediaApi } from './media.api';
import { MessagesApi } from './messages.api';
import { WhatsappLinesApi } from './whatsapp-lines.api';

const API = 'http://api.test';

describe('conversations endpoints', () => {
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([idempotencyInterceptor, apiErrorInterceptor])),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: API },
      ],
    });
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('lists an establishment’s inbox a page at a time', async () => {
    const api = TestBed.inject(ConversationsApi);
    const first = firstValueFrom(api.listForEstablishment('est-1', null, 30));
    const request = backend.expectOne(
      (r) => r.url === `${API}/api/v1/establishments/est-1/conversations`,
    );
    expect(request.request.params.has('cursor')).toBe(false);
    expect(request.request.params.get('size')).toBe('30');
    request.flush({
      items: [
        conversationResource('c-1', {
          assistantHandedOff: true,
          handoffSummary: 'Pidió hablar con alguien',
          assistantPausedUntil: '2026-10-25T02:00:00Z',
        }),
      ],
      nextCursor: 'abc',
    });
    const page = await first;
    expect(page.nextCursor).toBe('abc');
    expect(page.items[0]).toMatchObject({
      customerName: 'Rosa Huamán',
      unreadCount: 2,
      assistantHandedOff: true,
      handoffSummary: 'Pidió hablar con alguien',
      assignedMemberId: null,
    });
    expect(page.items[0].assistantPausedUntil).toEqual(new Date('2026-10-25T02:00:00Z'));

    api.listForEstablishment('est-1', 'abc', 30).subscribe();
    const next = backend.expectOne((r) => r.url.endsWith('/est-1/conversations'));
    expect(next.request.params.get('cursor')).toBe('abc');
    next.flush({ items: [] });
  });

  it('maps a conversation whose customer was deleted', async () => {
    const result = firstValueFrom(TestBed.inject(ConversationsApi).get('c-1'));
    backend.expectOne(`${API}/api/v1/conversations/c-1`).flush(
      conversationResource('c-1', {
        customerName: undefined,
        customerPhone: undefined,
        customerDeleted: true,
      }),
    );
    expect(await result).toMatchObject({
      customerName: null,
      customerPhone: null,
      customerDeleted: true,
    });
  });

  it('W8: marks a conversation read without an idempotency key', async () => {
    const result = firstValueFrom(TestBed.inject(ConversationsApi).markRead('c-1'));
    const request = backend.expectOne(`${API}/api/v1/conversations/c-1/read`);
    expect(request.request.method).toBe('POST');
    expect(request.request.headers.has('Idempotency-Key')).toBe(false);
    request.flush(conversationResource('c-1', { unreadCount: 0 }));
    expect((await result).unreadCount).toBe(0);
  });

  it('reads a chat newest first and older pages with before', async () => {
    const api = TestBed.inject(MessagesApi);
    const result = firstValueFrom(api.list('c-1', 'cur', 40));
    const request = backend.expectOne((r) => r.url === `${API}/api/v1/conversations/c-1/messages`);
    expect(request.request.params.get('before')).toBe('cur');
    expect(request.request.params.get('size')).toBe('40');
    request.flush({
      items: [
        messageResource('m-2', {
          direction: 'out',
          origin: 'assistant',
          status: 'read',
          choicesStyle: 'buttons',
          choices: ['15:00', '15:45'],
        }),
        messageResource('m-1', {
          kind: 'image',
          hasMedia: true,
          mediaMime: 'image/jpeg',
          mediaStatus: 'removed',
        }),
      ],
    });
    const page = await result;
    expect(page.nextCursor).toBeNull();
    expect(page.items[0]).toMatchObject({
      origin: 'assistant',
      status: 'read',
      choices: { style: 'buttons', titles: ['15:00', '15:45'] },
    });
    expect(page.items[1]).toMatchObject({ mediaStatus: 'removed', choices: null });
  });

  it('sends a reply with its idempotency key', async () => {
    const result = firstValueFrom(TestBed.inject(MessagesApi).send('c-1', 'Sí, a las 4', 'k-1'));
    const request = backend.expectOne(`${API}/api/v1/conversations/c-1/messages`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ body: 'Sí, a las 4' });
    expect(request.request.headers.get('Idempotency-Key')).toBe('k-1');
    request.flush(
      messageResource('m-9', { direction: 'out', origin: 'staff', status: 'pending' }),
      { status: 201, statusText: 'Created' },
    );
    expect((await result).status).toBe('pending');
  });

  it('downloads media as a blob and keeps pibble’s code on failure', async () => {
    const api = TestBed.inject(MediaApi);
    const ok = firstValueFrom(api.download('m-1'));
    const request = backend.expectOne(`${API}/api/v1/media/m-1`);
    expect(request.request.responseType).toBe('blob');
    request.flush(new Blob(['jpeg'], { type: 'image/jpeg' }));
    expect((await ok).type).toBe('image/jpeg');

    const removed = firstValueFrom(api.download('m-2')).catch((error: unknown) => error);
    backend
      .expectOne(`${API}/api/v1/media/m-2`)
      .flush(new Blob([JSON.stringify({ code: 'MEDIA_REMOVED' })]), {
        status: 404,
        statusText: 'Not Found',
      });
    expect(await removed).toMatchObject({ code: 'MEDIA_REMOVED' });
  });

  it('reads the establishment’s line', async () => {
    const result = firstValueFrom(TestBed.inject(WhatsappLinesApi).forEstablishment('est-1'));
    backend.expectOne(`${API}/api/v1/establishments/est-1/whatsapp-line`).flush({
      id: 'l-1',
      establishmentId: 'est-1',
      displayPhone: '+51 900 000 000',
      mode: 'coexistence',
      status: 'disconnected',
      templates: { reminder: 'approved', confirmation: 'pending' },
    });
    expect(await result).toMatchObject({
      connected: false,
      templates: { reminder: 'approved', confirmation: 'pending' },
    });
  });
});
