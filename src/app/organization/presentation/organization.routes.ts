import { Routes } from '@angular/router';
import { authGuard } from '../../iam/public-api';

/** The organization screens outside the signed-in frame: choosing one, and accepting an invitation. */
export const organizationEntryRoutes: Routes = [
  {
    path: 'organizaciones',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./views/organization-picker/organization-picker').then((m) => m.OrganizationPicker),
    title: 'Organizaciones · Takodu',
  },
  {
    // pibble's invitation email links to APP_URL/invitations/{token}.
    path: 'invitations/:token',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./views/invitation-acceptance/invitation-acceptance').then(
        (m) => m.InvitationAcceptance,
      ),
    title: 'Invitación · Takodu',
  },
];
