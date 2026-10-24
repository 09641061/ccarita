import { HttpContext, HttpContextToken, HttpInterceptorFn } from '@angular/common/http';

const IDEMPOTENCY_KEY = new HttpContextToken<string | null>(() => null);

/**
 * Marks a POST with pibble's `Idempotency-Key`. The key comes from `newIdempotencyKey()`, one per user action,
 * reused when that action is retried.
 */
export function idempotent(key: string): HttpContext {
  return new HttpContext().set(IDEMPOTENCY_KEY, key);
}

export const idempotencyInterceptor: HttpInterceptorFn = (request, next) => {
  const key = request.context.get(IDEMPOTENCY_KEY);
  return next(key ? request.clone({ setHeaders: { 'Idempotency-Key': key } }) : request);
};
