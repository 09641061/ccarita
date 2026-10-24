import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SessionStore } from '../../application/session.store';

/**
 * Signed in, or signed in again with the stored refresh token; otherwise `/ingresar` with the address to come
 * back to in `volver`. When pibble cannot be reached, the sign-in screen offers to retry the stored session.
 */
export const authGuard: CanActivateFn = async (_route, state) => {
  const router = inject(Router);
  const signIn = router.createUrlTree(['/ingresar'], { queryParams: { volver: state.url } });
  try {
    return (await inject(SessionStore).restore()) || signIn;
  } catch {
    return signIn;
  }
};
