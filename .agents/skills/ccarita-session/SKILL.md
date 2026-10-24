---
name: ccarita-session
description: How a ccarita user signs in and works inside one organization and establishment — passwordless email codes, access and refresh tokens, the iam interceptor and guards, TenantContext and X-Organization-Id, the organization picker and establishment switcher, invitations, what each role (owner, manager, staff, Takodu operator) sees, and the inactive plan (O6). Use when building sign-in, navigation, guards, role-dependent UI, the plan banner, or any screen whose content depends on who is signed in.
---

# Session, tenant and roles in ccarita

Product rules: I1–I6 (sign-in), O9, O10 and O13 (roles, invitations, visibility), O5 and O6 (plan), and the roles table in `../docs/03-business-domain.md` §5. Token storage is a [decision](../../../docs/decisions/implemented/2026-10-23-session-tokens-in-the-browser.md).

## Sign-in (`iam`)

1. `/ingresar` (`SignIn`): the email, then the 6-digit code (`CodeInput`: one input with `one-time-code`, shown as six boxes). The sixth digit submits. pibble's dev mode prints the code in its console; development builds say so.
2. `SessionStore` (`requestCode`, `signIn`, `restore`, `signOut`, `user`, `isSignedIn`) is what other contexts use. Requesting a code, signing in, refreshing and accepting an invitation send no `Idempotency-Key`: pibble marks them `@WithoutIdempotencyKey`.
3. `SessionHolder` keeps the access token in memory and the refresh token in `localStorage`. `authInterceptor` (first in `app.config.ts`) adds `Bearer` only to `API_BASE_URL`, refreshes an expiring token before sending, and on a 401 refreshes once (shared by concurrent calls) and replays. Calls marked `anonymous()` get no token.
4. A refused refresh clears tokens and `TenantContext`; `Workspace` then returns to `/ingresar?volver=…`. Sign-out deletes the session in pibble and clears both, even offline.
5. After sign-in, `volver` passes through `safeReturnUrl`, so only paths inside the app are followed.

The account sessions list (`GET`/`DELETE /api/v1/auth/sessions`) belongs to the account screen (F9).

## Organization and establishment (`organization`)

- `CurrentOrganization.load()` reads `GET /api/v1/organizations` once per user. It drops a stored selection that is not a membership and selects the only organization when there is one. `selected()`, `role()`, `can(action)`, `planActiveUntil()` and `planActive()` come from pibble; `details` is `GET /api/v1/organization` (plan and fresh end date).
- `/organizaciones` (`OrganizationPicker`) lists several organizations; with one it goes straight on, and with none it explains how to get one and links to `/primeros-pasos` (onboarding, F7).
- `CurrentEstablishment` lists `GET /api/v1/establishments` without archived ones (pibble returns the assigned ones for staff, O13) and exposes `id()`, `timeZone()` and `select()`. `TenantContext` remembers one establishment per organization; a missing one falls back to the first. Other contexts key their reads on it.
- `/invitations/:token` is the link pibble emails. Signed out, `authGuard` brings the user back after sign-in. Accepting selects the organization and opens `/agenda`. `INVITATION_EXPIRED`, `INVITATION_NOT_FOUND`, `INVITATION_CONFLICT` and `ACCESS_DENIED` (another email; pibble does not say which) each have a state.

## The frame

`Workspace` fills `Shell`: `navigationFor(role)`, the establishment switcher, the plan card, and the account menu (Cuenta, Cambiar de organización with several, Salir). Below 1024 px the switcher and account go in the top bar. While `planActive()` is false, `PlanBanner` sits above every screen with `environment.renewalContact`.

## Roles in the UI

`MAIN_NAVIGATION` lists the roles of each destination; `canPerform(role, action)` holds the actions of §5.

- Hide navigation and actions the role cannot use; a deep link a role cannot use shows `/sin-permiso`, and pibble's `ACCESS_DENIED` shows the same state.
- **pibble is the authority.** A hidden button is convenience, not security: never skip a request because the UI believes it would fail, and never send a role or organization in a body.

## Guards

Functional guards in `presentation/guards`, since they read stores; each returns `true` or a `UrlTree`:

- `authGuard` (`iam`): signed in or restored, else `/ingresar?volver=…`.
- `organizationGuard` (`organization`): an organization is selected, else `/organizaciones?volver=…`. It leaves signed-out users to `authGuard`.
- `roleGuard(roles)` (`organization`): the selected role is one of `roles`, else `/sin-permiso`.
- `/platform` will add an operator guard on `GET /internal/v1/operator` (F10).

## Inactive plan (O6)

`planActive()` is false once `planActiveUntil` has passed. Disable booking, rescheduling, sending messages and changing settings. Keep reading, team management, archiving, finishing booked appointments, time blocks, assigning and reading conversations, pausing the assistant, customers and usage enabled. pibble still rejects what O6 forbids with `PLAN_INACTIVE`, which the screen shows as its message.

## Checklist

- [ ] No token or tenant id is read from a form or sent in a body.
- [ ] One refresh runs at a time; a failed refresh signs out and clears `TenantContext`.
- [ ] Reads key on `CurrentEstablishment`, and times use its `timeZone`.
- [ ] Role-based hiding matches §5, and `ACCESS_DENIED` still renders a state.
- [ ] The inactive plan shows the banner and disables only what O6 forbids.
