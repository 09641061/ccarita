import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { settle } from '../../../testing/settle';
import { CurrentEstablishment, CurrentOrganization } from '../../organization/public-api';
import { API_BASE_URL } from '../../shared/infrastructure/http/api-base-url';
import { idempotencyInterceptor } from '../../shared/infrastructure/http/idempotency';
import { InboxStore } from './inbox.store';
import { WhatsappLineStore } from './whatsapp-line.store';

const API = 'http://api.test';
const LINE = `${API}/api/v1/establishments/est-1/whatsapp-line`;
const line = (status: string) => ({
  id: 'l-1',
  establishmentId: 'est-1',
  displayPhone: '+51 900 000 000',
  mode: 'coexistence',
  status,
  templates: {},
});

describe('WhatsappLineStore', () => {
  let backend: HttpTestingController;
  let store: WhatsappLineStore;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([idempotencyInterceptor])),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: API },
        { provide: CurrentEstablishment, useValue: { id: signal('est-1') } },
        { provide: CurrentOrganization, useValue: { selected: signal(null) } },
      ],
    });
    backend = TestBed.inject(HttpTestingController);
    store = TestBed.inject(WhatsappLineStore);
  });

  afterEach(() => backend.verify());

  async function flushLine(status: string) {
    TestBed.tick();
    backend.expectOne(LINE).flush(line(status));
    await settle();
  }

  it('is the line the inbox reads', () => {
    expect(TestBed.inject(InboxStore).line).toBe(store.line);
    backend.match(() => true);
  });

  it('W2: reloads the line after connecting', async () => {
    await flushLine('disconnected');
    const command = {
      code: 'dev-code',
      wabaId: 'w',
      phoneNumberId: 'p',
      mode: 'coexistence' as const,
    };

    const done = store.connect('est-1', command, 'key-1');
    const post = backend.expectOne((r) => r.method === 'POST' && r.url === LINE);
    expect(post.request.headers.get('Idempotency-Key')).toBe('key-1');
    post.flush(line('connected'), { status: 201, statusText: '' });
    await done;
    await flushLine('connected');

    expect(store.line.value()?.connected).toBe(true);
  });

  it('W1: reloads the line after disconnecting', async () => {
    await flushLine('connected');

    const done = store.disconnect('est-1');
    backend.expectOne((r) => r.method === 'DELETE').flush(null, { status: 204, statusText: '' });
    await done;
    await flushLine('disconnected');

    expect(store.line.value()?.connected).toBe(false);
  });
});
