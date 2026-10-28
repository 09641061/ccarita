import {
  HttpClient,
  HttpDownloadProgressEvent,
  HttpEvent,
  HttpEventType,
} from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, concat, mergeMap, of, throwError } from 'rxjs';
import type {
  InboxChange as InboxChangeResource,
  InboxConversationSummary as InboxConversationSummaryResource,
} from '../../shared/infrastructure/api/pibble.schema';
import { ApiError } from '../../shared/domain/model/api-error';
import { API_BASE_URL } from '../../shared/infrastructure/http/api-base-url';
import { AppointmentChange, ConversationSummary, InboxChange } from '../domain/model/inbox-change';
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

const instant = (value: string | undefined) => (value ? new Date(value) : null);
const APPOINTMENT_CHANGES: Readonly<Record<string, AppointmentChange>> = {
  appointment_booked: 'booked',
  appointment_rescheduled: 'rescheduled',
  appointment_cancelled: 'cancelled',
};

/** Unknown types and events missing their ids are dropped, so a newer pibble never breaks the stream. */
function toInboxChange(data: string): InboxChange[] {
  let resource: InboxChangeResource;
  try {
    resource = JSON.parse(data) as InboxChangeResource;
  } catch {
    return [];
  }
  const { type, conversationId, establishmentId, appointmentId } = resource;
  if (type === 'ping') return [{ type: 'ping' }];
  if (!establishmentId) return [];
  if (type === 'conversation' && conversationId)
    return [
      {
        type: 'conversation',
        conversationId,
        establishmentId,
        summary: toSummary(resource.conversation),
      },
    ];
  if ((type === 'assistant_typing' || type === 'assistant_idle') && conversationId)
    return [
      { type: 'assistant', conversationId, establishmentId, typing: type === 'assistant_typing' },
    ];
  const change = type ? APPOINTMENT_CHANGES[type] : undefined;
  if (change && appointmentId)
    return [{ type: 'appointment', appointmentId, establishmentId, change }];
  return [];
}

function toSummary(
  resource: InboxConversationSummaryResource | undefined,
): ConversationSummary | null {
  if (!resource?.lastMessageAt) return null;
  return {
    lastMessageAt: new Date(resource.lastMessageAt),
    lastInboundAt: instant(resource.lastInboundAt),
    unreadCount: resource.unreadCount ?? 0,
    windowClosesAt: instant(resource.windowClosesAt),
    assistantPausedUntil: instant(resource.assistantPausedUntil),
    assistantHandedOff: resource.assistantHandedOff ?? false,
    assistantPausedManually: resource.assistantPausedManually ?? false,
  };
}
