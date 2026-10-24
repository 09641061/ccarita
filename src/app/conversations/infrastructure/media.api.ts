import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../../shared/infrastructure/http/api-base-url';

/** `/api/v1/media/{messageId}`: a file a customer sent, which needs the token, so it is fetched as a blob. */
@Injectable({ providedIn: 'root' })
export class MediaApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** @throws ApiError `MEDIA_NOT_READY`, `MEDIA_DOWNLOAD_FAILED`, `MEDIA_REMOVED`. */
  download(messageId: string): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/api/v1/media/${messageId}`, { responseType: 'blob' });
  }
}
