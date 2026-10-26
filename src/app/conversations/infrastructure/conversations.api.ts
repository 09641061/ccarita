import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import type {
  AssignConversationRequest,
  Conversation as ConversationResource,
  ConversationPage as ConversationPageResource,
} from '../../shared/infrastructure/api/pibble.schema';
import { API_BASE_URL } from '../../shared/infrastructure/http/api-base-url';
import { idempotent } from '../../shared/infrastructure/http/idempotency';
import { Conversation } from '../domain/model/conversation';
import { ConversationPage } from '../domain/model/conversation-page';
import { toConversation, toConversationPage } from './conversation.assembler';

/** `/api/v1/conversations/{id}` and an establishment's inbox. */
@Injectable({ providedIn: 'root' })
export class ConversationsApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** W7: newest activity first. @throws ApiError `ACCESS_DENIED` for staff of another establishment. */
  listForEstablishment(
    establishmentId: string,
    cursor: string | null,
    size: number,
  ): Observable<ConversationPage> {
    return this.http
      .get<ConversationPageResource>(
        `${this.baseUrl}/api/v1/establishments/${establishmentId}/conversations`,
        { params: { ...(cursor ? { cursor } : {}), size } },
      )
      .pipe(map(toConversationPage));
  }

  /** @throws ApiError `CONVERSATION_NOT_FOUND`, `ACCESS_DENIED`. */
  get(conversationId: string): Observable<Conversation> {
    return this.http
      .get<ConversationResource>(`${this.baseUrl}/api/v1/conversations/${conversationId}`)
      .pipe(map(toConversation));
  }

  /** W8: resets the unread count; pibble takes no idempotency key and allows it on an inactive plan. */
  markRead(conversationId: string): Observable<Conversation> {
    return this.http
      .post<ConversationResource>(
        `${this.baseUrl}/api/v1/conversations/${conversationId}/read`,
        null,
      )
      .pipe(map(toConversation));
  }

  /** W9: informative; `null` unassigns. @throws ApiError `MEMBER_NOT_AT_ESTABLISHMENT`. */
  assign(conversationId: string, memberId: string | null): Observable<Conversation> {
    const request: AssignConversationRequest = memberId ? { memberId } : {};
    return this.http
      .put<ConversationResource>(
        `${this.baseUrl}/api/v1/conversations/${conversationId}/assignee`,
        request,
      )
      .pipe(map(toConversation));
  }

  /** A3: keeps the assistant quiet until someone resumes it; allowed on an inactive plan. */
  pauseAssistant(conversationId: string, idempotencyKey: string): Observable<Conversation> {
    return this.assistant(conversationId, 'pause', idempotencyKey);
  }

  /** A3, A7: clears every pause and the handoff; the assistant answers the next customer message. */
  resumeAssistant(conversationId: string, idempotencyKey: string): Observable<Conversation> {
    return this.assistant(conversationId, 'resume', idempotencyKey);
  }

  private assistant(
    conversationId: string,
    action: 'pause' | 'resume',
    idempotencyKey: string,
  ): Observable<Conversation> {
    return this.http
      .post<ConversationResource>(
        `${this.baseUrl}/api/v1/conversations/${conversationId}/assistant/${action}`,
        null,
        { context: idempotent(idempotencyKey) },
      )
      .pipe(map(toConversation));
  }
}
