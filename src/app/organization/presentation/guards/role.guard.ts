import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { CurrentOrganization } from '../../application/current-organization.store';
import { MemberRole } from '../../domain/model/member-role';

/**
 * The selected organization's role is one of `roles` (Mapa por rol, 03 §5); otherwise the no-permission screen.
 * Convenience only: pibble still answers `ACCESS_DENIED`.
 */
export function roleGuard(roles: readonly MemberRole[]): CanActivateFn {
  return async () => {
    const organization = inject(CurrentOrganization);
    const forbidden = inject(Router).createUrlTree(['/sin-permiso']);
    try {
      await organization.load();
    } catch {
      return forbidden;
    }
    const role = organization.role();
    return (role !== null && roles.includes(role)) || forbidden;
  };
}
