---
name: ccarita-session
description: How a ccarita user signs in and works inside one organization and establishment — passwordless email codes, access and refresh tokens, the iam interceptor and guards, TenantContext and X-Organization-Id, the organization and establishment pickers, what each role (owner, manager, staff, Takodu operator) sees, and the inactive plan (O6). Use when building sign-in, navigation, guards, role-dependent UI, the plan banner, or any screen whose content depends on who is signed in.
---

# Session, tenant and roles in ccarita

Product rules: I1–I6 (sign-in), O9 and O13 (roles and visibility), O5 and O6 (plan), and the roles table in `../docs/03-business-domain.md` §5. The token storage decision is [proposed](../../../docs/decisions/proposed/2026-10-23-session-tokens-in-the-browser.md) until `iam` is built; build it as written there and move the record to `implemented/`.

## Sign-in (`iam`)

1. `POST /api/v1/auth/login-codes` with the email; pibble emails a 6-digit code (dev mode prints it in pibble's console). `LOGIN_CODE_LIMIT` means five codes this hour.
2. `POST /api/v1/auth/sessions` with email and code returns `SessionTokens`: `sessionId`, `accessToken` (15 min), `refreshToken` (30 days), `user`.
3. `SessionStore` keeps the access token and user in signals, the refresh token in storage, and exposes `isSignedIn`, `user` and `signOut()`.
4. `authInterceptor` (in `iam/infrastructure`) adds `Authorization: Bearer …` to calls to `API_BASE_URL`, and on a 401 runs one shared `POST /api/v1/auth/session-refreshes` with the refresh token, then replays the request once. A failed refresh signs out.
5. `GET` and `DELETE /api/v1/auth/sessions` list and end sessions on other devices.

`iam` is below `organization`, so the interceptor is registered in `app.config.ts` before `tenantInterceptor`, and signing out also calls `TenantContext.clear()`.

## Organization and establishment (`organization`)

- `GET /api/v1/organizations` lists the caller's organizations as `JoinedOrganization` (`id`, `name`, `planActiveUntil`, `memberId`, `role`). None → onboarding (`POST /api/v1/organizations`) or an invitation (`POST /api/v1/invitation-acceptances`). One → select it. Several → the picker.
- Selecting calls `TenantContext.selectOrganization(id)`, which every later `/api/v1` call sends as `X-Organization-Id`.
- `GET /api/v1/establishments` returns the establishments the caller sees: all for owners and managers, assigned ones for staff (O13). `organization` exposes a `CurrentEstablishment` store through `public-api.ts` (`id`, `timeZone`, `establishments`, `select`), backed by `TenantContext.selectEstablishment`; other contexts key their reads on it.
- A stored selection that is no longer valid (membership removed, establishment archived) is replaced by the first valid one, or the picker.

## Roles in the UI

`CurrentMember` (in `organization`, exported) holds the role of the selected organization and answers `can(action)` for the actions in §5: `editOrganization`, `manageEstablishments`, `connectWhatsapp`, `editSettings`, `manageTeam`, `seeAllEstablishments`, `manageEveryonesCalendar`, `deleteCustomers`.

- Hide navigation and actions the role cannot use; deep links still render the no-permission state when pibble answers `ACCESS_DENIED`.
- **pibble is the authority.** A hidden button is convenience, not security: never skip a request because the UI believes it would fail, and never send a role or organization in a body.

## Guards

Functional guards in `infrastructure` returning `true` or a `UrlTree` (never calling `router.navigate` themselves):

- `signedInGuard` (`iam`): signed in, else `/ingresar` with the return URL.
- `organizationSelectedGuard` (`organization`): an organization is selected, else the picker or onboarding.
- `roleGuard(action)` (`organization`): `CurrentMember.can(action)`, else the no-permission view.
- `operatorGuard` (`platform`): `GET /internal/v1/operator` answers 200, else no-permission. `/platform` routes need no organization.

## Inactive plan (O6)

`JoinedOrganization.planActiveUntil` in the past, or any `PLAN_INACTIVE` answer, sets `CurrentOrganization.planActive` to false. The layout shows a persistent banner explaining renewal by transfer, Yape or Plin through the Takodu team. Disable booking, rescheduling, sending messages and changing settings. Keep reading, team management, archiving, finishing booked appointments, time blocks, assigning and reading conversations, pausing the assistant, customers and usage enabled. pibble still rejects what O6 forbids, so a stale flag only costs one error message.

## Checklist

- [ ] No token or tenant id is read from a form or sent in a body.
- [ ] One refresh runs at a time; a failed refresh signs out and clears `TenantContext`.
- [ ] Reads key on `CurrentEstablishment`, and times use its `timeZone`.
- [ ] Role-based hiding matches §5, and `ACCESS_DENIED` still renders a state.
- [ ] The inactive plan shows the banner and disables only what O6 forbids.
