import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import type { WhatsappLine as WhatsappLineResource } from '../../shared/infrastructure/api/pibble.schema';
import { API_BASE_URL } from '../../shared/infrastructure/http/api-base-url';
import { WhatsappLine } from '../domain/model/whatsapp-line';
import { toWhatsappLine } from './whatsapp-line.assembler';

/** `/api/v1/establishments/{id}/whatsapp-line`; connecting and disconnecting are the owner's settings (F7). */
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
}
