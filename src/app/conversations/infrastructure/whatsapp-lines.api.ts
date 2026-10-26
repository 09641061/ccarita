import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import type { WhatsappLine as WhatsappLineResource } from '../../shared/infrastructure/api/pibble.schema';
import { API_BASE_URL } from '../../shared/infrastructure/http/api-base-url';
import { idempotent } from '../../shared/infrastructure/http/idempotency';
import { ConnectLine, WhatsappLine } from '../domain/model/whatsapp-line';
import { toConnectWhatsappLineRequest, toWhatsappLine } from './whatsapp-line.assembler';

/** `/api/v1/establishments/{id}/whatsapp-line`; only the owner connects and disconnects it (03 §5). */
@Injectable({ providedIn: 'root' })
export class WhatsappLinesApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** The connected line, else the last one. @throws ApiError `WHATSAPP_LINE_NOT_FOUND` when it never had one. */
  forEstablishment(establishmentId: string): Observable<WhatsappLine> {
    return this.http
      .get<WhatsappLineResource>(
        `${this.baseUrl}/api/v1/establishments/${establishmentId}/whatsapp-line`,
      )
      .pipe(map(toWhatsappLine));
  }

  /**
   * W1, W2: pibble finishes Embedded Signup with Meta while the owner waits.
   * @throws ApiError `LINE_ALREADY_CONNECTED`, `WHATSAPP_SIGNUP_FAILED`, `ESTABLISHMENT_ARCHIVED`, `PLAN_INACTIVE`.
   */
  connect(
    establishmentId: string,
    command: ConnectLine,
    idempotencyKey: string,
  ): Observable<WhatsappLine> {
    return this.http
      .post<WhatsappLineResource>(
        `${this.baseUrl}/api/v1/establishments/${establishmentId}/whatsapp-line`,
        toConnectWhatsappLineRequest(command),
        { context: idempotent(idempotencyKey) },
      )
      .pipe(map(toWhatsappLine));
  }

  /** W1: conversations stay, and connecting the same number again reuses them. No key: a DELETE repeats safely. */
  disconnect(establishmentId: string): Observable<void> {
    return this.http.delete<void>(
      `${this.baseUrl}/api/v1/establishments/${establishmentId}/whatsapp-line`,
    );
  }
}
