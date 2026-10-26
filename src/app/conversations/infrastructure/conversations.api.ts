import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import type {
  Conversation as ConversationResource,
  ConversationPage as ConversationPageResource,
} from '../../shared/infrastructure/api/pibble.schema';
import { API_BASE_URL } from '../../shared/infrastructure/http/api-base-url';
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
}
