import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SessionStore } from '../../../iam/public-api';
import { CurrentOrganization } from '../../application/current-organization.store';

/**
 * An organization is selected; otherwise the picker, which also explains when the user has none or the list could
 * not load. Signed-out users are left to `authGuard`.
 */
export const organizationGuard: CanActivateFn = async (_route, state) => {
  const session = inject(SessionStore);
  const organization = inject(CurrentOrganization);
  const picker = inject(Router).createUrlTree(['/organizaciones'], {
    queryParams: { volver: state.url },
  });
  try {
    if (!(await session.restore())) return true;
    await organization.load();
  } catch {
    return picker;
  }
  return organization.selected() ? true : picker;
};
