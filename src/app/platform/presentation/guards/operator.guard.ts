import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SessionStore } from '../../../iam/public-api';
import { ApiError } from '../../../shared/domain/model/api-error';
import { OperatorStore } from '../../application/operator.store';

/**
 * The Takodu team only, as pibble's operator check says on each entry: anyone else goes to `/sin-permiso`, and a
 * session pibble no longer accepts to sign-in. When pibble cannot be reached the area opens and its screens offer
 * to retry, since pibble checks every internal call anyway. Angular runs it beside `authGuard`, so it asks only once
 * a session exists and leaves the signed-out to that guard.
 */
export const operatorGuard: CanActivateFn = async (_route, state) => {
  const router = inject(Router);
  const operator = inject(OperatorStore);
  const signedIn = await inject(SessionStore)
    .restore()
    .catch(() => false);
  if (!signedIn) return true;
  try {
    return (await operator.verify()) || router.createUrlTree(['/sin-permiso']);
  } catch (error) {
    return ApiError.of(error).status === 401
      ? router.createUrlTree(['/ingresar'], { queryParams: { volver: state.url } })
      : true;
  }
};
