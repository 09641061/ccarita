import { HttpHandlerFn, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, defer, from, switchMap, throwError } from 'rxjs';
import { ApiError } from '../../shared/domain/model/api-error';
import { API_BASE_URL } from '../../shared/infrastructure/http/api-base-url';
import { ANONYMOUS } from './anonymous';
import { SessionHolder } from './session-holder';

/**
 * First in the chain: adds `Authorization: Bearer …` to calls to pibble, and only to pibble. On a 401 it refreshes
 * once (shared with concurrent calls) and sends the request again; a second 401 reaches the caller.
 */
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  if (request.context.get(ANONYMOUS) || !request.url.startsWith(`${inject(API_BASE_URL)}/`))
    return next(request);
  const holder = inject(SessionHolder);
  return defer(() => from(holder.accessToken())).pipe(
    switchMap((token) =>
      send(request, next, token).pipe(
        catchError((error: unknown) => {
          if (!token || !(error instanceof ApiError) || error.status !== 401)
            return throwError(() => error);
          return from(holder.renewAfter(token)).pipe(
            switchMap((renewed) =>
              renewed ? send(request, next, renewed) : throwError(() => error),
            ),
          );
        }),
      ),
    ),
  );
};

function send(request: HttpRequest<unknown>, next: HttpHandlerFn, token: string | null) {
  return next(
    token ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : request,
  );
}
