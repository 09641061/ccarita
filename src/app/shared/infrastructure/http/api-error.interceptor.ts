import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, from, mergeMap, throwError } from 'rxjs';
import { ApiError } from '../../domain/model/api-error';

/** Every failed HTTP call reaches stores as an {@link ApiError}. */
export const apiErrorInterceptor: HttpInterceptorFn = (request, next) =>
  next(request).pipe(
    catchError((error: unknown) =>
      from(withReadBody(error)).pipe(mergeMap((read) => throwError(() => toApiError(read)))),
    ),
  );

export function toApiError(error: unknown): ApiError {
  if (!(error instanceof HttpErrorResponse)) return ApiError.of(error);
  if (error.status === 0) return new ApiError(0, 'NETWORK_ERROR', error.message);
  const body: unknown = error.error;
  if (body && typeof body === 'object' && 'code' in body && typeof body.code === 'string') {
    const message =
      'message' in body && typeof body.message === 'string' ? body.message : error.message;
    return new ApiError(error.status, body.code, message);
  }
  return new ApiError(error.status, 'UNEXPECTED_ERROR', error.message);
}

/** A download (`responseType: 'blob'`) receives pibble's JSON error as a blob; read it for the code. */
async function withReadBody(error: unknown): Promise<unknown> {
  if (!(error instanceof HttpErrorResponse) || !(error.error instanceof Blob)) return error;
  try {
    const body: unknown = JSON.parse(await error.error.text());
    return new HttpErrorResponse({
      error: body,
      headers: error.headers,
      status: error.status,
      statusText: error.statusText,
      url: error.url ?? undefined,
    });
  } catch {
    return error;
  }
}
