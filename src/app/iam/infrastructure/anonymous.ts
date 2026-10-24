import { HttpContext, HttpContextToken } from '@angular/common/http';

/** Requests that `authInterceptor` sends without a token and never refreshes for. */
export const ANONYMOUS = new HttpContextToken<boolean>(() => false);

/** Marks a call made before or instead of a session: requesting a code, signing in, refreshing. */
export function anonymous(): HttpContext {
  return new HttpContext().set(ANONYMOUS, true);
}
