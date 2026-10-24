import { HttpEventType, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { InboxChange } from '../domain/model/inbox-change';
import { API_BASE_URL } from '../../shared/infrastructure/http/api-base-url';
import { apiErrorInterceptor } from '../../shared/infrastructure/http/api-error.interceptor';
import { InboxStreamApi } from './inbox-stream.api';

const API = 'http://api.test';

describe('InboxStreamApi', () => {
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiErrorInterceptor])),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: API },
      ],
    });
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  function progress(partialText: string) {
    return {
      type: HttpEventType.DownloadProgress,
      loaded: partialText.length,
      partialText,
    } as const;
  }

  it('emits the changes as the text arrives, then fails when pibble closes the stream', () => {
    const changes: InboxChange[] = [];
    let failure: unknown;
    TestBed.inject(InboxStreamApi)
      .follow()
      .subscribe({ next: (c) => changes.push(c), error: (e: unknown) => (failure = e) });
    const request = backend.expectOne(`${API}/api/v1/inbox/stream`);
    expect(request.request.reportProgress).toBe(true);
    expect(request.request.headers.get('Accept')).toBe('text/event-stream');

    const ping = 'data:{"type":"ping"}\n\n';
    const change =
      'data:{"type":"conversation","conversationId":"c-1","establishmentId":"est-1"}\n\n';
    request.event(progress(ping));
    request.event(progress(ping + change.slice(0, 20)));
    expect(changes).toEqual([{ type: 'ping' }]);
    request.event(progress(ping + change + 'data:not json\n\n'));
    expect(changes).toEqual([
      { type: 'ping' },
      { type: 'conversation', conversationId: 'c-1', establishmentId: 'est-1' },
    ]);
    expect(failure).toBeUndefined();

    request.flush(ping + change);
    expect(failure).toMatchObject({ code: 'NETWORK_ERROR' });
  });

  it('aborts the request when unsubscribed', () => {
    const subscription = TestBed.inject(InboxStreamApi).follow().subscribe();
    const request = backend.expectOne(`${API}/api/v1/inbox/stream`);
    subscription.unsubscribe();
    expect(request.cancelled).toBe(true);
  });
});
