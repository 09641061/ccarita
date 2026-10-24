import {
  HttpClient,
  HttpDownloadProgressEvent,
  HttpEvent,
  HttpEventType,
} from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, concat, mergeMap, of, throwError } from 'rxjs';
import type { InboxChange as InboxChangeResource } from '../../shared/infrastructure/api/pibble.schema';
import { ApiError } from '../../shared/domain/model/api-error';
import { API_BASE_URL } from '../../shared/infrastructure/http/api-base-url';
import { InboxChange } from '../domain/model/inbox-change';
import { ServerSentEvents } from './server-sent-events';

/**
 * `GET /api/v1/inbox/stream`, read through `HttpClient`, whose fetch backend reports the text as it arrives. The
 * interceptors add the token (refreshing it first when it is about to expire) and `X-Organization-Id`, which
 * `EventSource` cannot send ([decision](docs/decisions/implemented/2026-10-24-inbox-stream-through-http-client.md)).
 */
@Injectable({ providedIn: 'root' })
export class InboxStreamApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /**
   * One connection: its changes, then an `ApiError` (`NETWORK_ERROR` when pibble closed it), since the stream
   * never ends on its own. Unsubscribing aborts the request.
   */
  follow(): Observable<InboxChange> {
    const events = new ServerSentEvents();
    let read = 0;
    const changes = this.http
      .get(`${this.baseUrl}/api/v1/inbox/stream`, {
        observe: 'events',
        reportProgress: true,
        responseType: 'text',
        headers: { Accept: 'text/event-stream' },
      })
      .pipe(
        mergeMap((event: HttpEvent<string>) => {
          if (event.type !== HttpEventType.DownloadProgress) return of();
          const text = (event as HttpDownloadProgressEvent).partialText ?? '';
          const chunk = text.slice(read);
          read = text.length;
          return of(...events.push(chunk).flatMap(toInboxChange));
        }),
      );
    return concat(
      changes,
      throwError(() => new ApiError(0, 'NETWORK_ERROR', 'The inbox stream ended')),
    );
  }
}

function toInboxChange(data: string): InboxChange[] {
  let resource: InboxChangeResource;
  try {
    resource = JSON.parse(data) as InboxChangeResource;
  } catch {
    return [];
  }
  if (resource.type === 'ping') return [{ type: 'ping' }];
  if (resource.type === 'conversation' && resource.conversationId && resource.establishmentId)
    return [
      {
        type: 'conversation',
        conversationId: resource.conversationId,
        establishmentId: resource.establishmentId,
      },
    ];
  return [];
}
