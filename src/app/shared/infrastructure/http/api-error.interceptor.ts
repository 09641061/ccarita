import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { ApiError } from '../../domain/model/api-error';

/** Every failed HTTP call reaches stores as an {@link ApiError}. */
export const apiErrorInterceptor: HttpInterceptorFn = (request, next) =>
  next(request).pipe(catchError((error: unknown) => throwError(() => toApiError(error))));

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
