import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import type {
  Message as MessageResource,
  MessagePage as MessagePageResource,
  SendMessageRequest,
  SendTemplateRequest,
} from '../../shared/infrastructure/api/pibble.schema';
import { API_BASE_URL } from '../../shared/infrastructure/http/api-base-url';
import { idempotent } from '../../shared/infrastructure/http/idempotency';
import { Message } from '../domain/model/message';
import { MessagePage } from '../domain/model/message-page';
import { SendTemplate } from '../domain/model/template-choice';
import { toMessage, toMessagePage } from './message.assembler';

/** `/api/v1/conversations/{id}/messages`: reading a chat and replying. */
@Injectable({ providedIn: 'root' })
export class MessagesApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** Newest first; `before` is the `nextCursor` of the newer page. Reading does not mark the chat read (W8). */
  list(conversationId: string, before: string | null, size: number): Observable<MessagePage> {
    return this.http
      .get<MessagePageResource>(`${this.baseUrl}/api/v1/conversations/${conversationId}/messages`, {
        params: { ...(before ? { before } : {}), size },
      })
      .pipe(map(toMessagePage));
  }

  /**
   * W6, A3: queues a staff text, which pauses the assistant for 12 hours.
   * @throws ApiError `WINDOW_CLOSED`, `LINE_DISCONNECTED`, `PLAN_INACTIVE`, `VALIDATION_ERROR`.
   */
  send(conversationId: string, body: string, idempotencyKey: string): Observable<Message> {
    const request: SendMessageRequest = { body };
    return this.http
      .post<MessageResource>(
        `${this.baseUrl}/api/v1/conversations/${conversationId}/messages`,
        request,
        { context: idempotent(idempotencyKey) },
      )
      .pipe(map(toMessage));
  }

  /**
   * W6, W11, W12, A3: queues an appointment's reminder or confirmation, which pauses the assistant for 12 hours.
   * @throws ApiError `TEMPLATE_NOT_APPROVED`, `APPOINTMENT_NOT_UPCOMING`, `LINE_DISCONNECTED`, `CUSTOMER_DELETED`,
   * `PLAN_INACTIVE`.
   */
  sendTemplate(
    conversationId: string,
    command: SendTemplate,
    idempotencyKey: string,
  ): Observable<Message> {
    const request: SendTemplateRequest = { ...command };
    return this.http
      .post<MessageResource>(
        `${this.baseUrl}/api/v1/conversations/${conversationId}/templates`,
        request,
        { context: idempotent(idempotencyKey) },
      )
      .pipe(map(toMessage));
  }
}
