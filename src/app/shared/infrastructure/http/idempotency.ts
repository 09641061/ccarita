import { HttpContext, HttpContextToken, HttpInterceptorFn } from '@angular/common/http';

const IDEMPOTENCY_KEY = new HttpContextToken<string | null>(() => null);

/**
 * Marks a POST with pibble's `Idempotency-Key`. Create one key per user action and pass the same key when that
 * action is retried, so a lost response never books, sends or invites twice.
 */
export function idempotent(key: string): HttpContext {
  return new HttpContext().set(IDEMPOTENCY_KEY, key);
}

/** A key for one user action. */
export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}

export const idempotencyInterceptor: HttpInterceptorFn = (request, next) => {
  const key = request.context.get(IDEMPOTENCY_KEY);
  return next(key ? request.clone({ setHeaders: { 'Idempotency-Key': key } }) : request);
};
