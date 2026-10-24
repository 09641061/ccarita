# Decision: Session tokens in the browser

Status: implemented

## Problem

pibble returns an access token (15 minutes) and a refresh token (30 days, rotated on every use, I5) in the body of `POST /api/v1/auth/sessions`. Staff on a shared phone or a salon computer should stay signed in for days, but a token readable by injected script would let an attacker act as them.

## Decision

`SessionHolder` (`iam/infrastructure`) keeps the access token only in memory and the refresh token in `localStorage` under `ccarita.refreshToken`. `authInterceptor`, first in the chain, adds the access token to calls to `API_BASE_URL` only. Before sending, an access token within 30 seconds of its expiry is refreshed instead. On a 401 it runs `POST /api/v1/auth/session-refreshes` and sends the request again once. One refresh runs at a time: concurrent requests wait for it, and a request rejected with a token that another refresh already replaced takes the new one without a second refresh. After a reload the first request, or `authGuard`, restores the session from the stored refresh token.

A refused refresh (any 401, `REFRESH_TOKEN_INVALID` included) clears the tokens and `TenantContext`, and `Workspace` returns to `/ingresar` with the current address in `volver`. A network failure keeps the stored token, and the sign-in screen offers to retry it. Signing out calls `DELETE /api/v1/auth/sessions/{id}` and clears storage and `TenantContext` even when pibble cannot be reached. The app loads no third-party script; the production host must send a strict Content Security Policy.

## Alternatives considered

**Both tokens in memory.** Safest against script, but every reload or new tab signs the user out, which a salon cannot live with.

**`sessionStorage`.** Survives reloads, but not a closed tab, so staff sign in every morning.

**An `HttpOnly` cookie set by pibble.** Out of reach for script, but pibble answers with JSON tokens and has no cookie or CSRF handling; it is the way to go if pibble adds them.

## Consequences

A reload keeps the user signed in, and two requests failing at the same time cause one refresh (`auth.interceptor.spec.ts`). A refused refresh and sign-out leave no token in storage (`auth.interceptor.spec.ts`, `session.store.spec.ts`). Script injected into the page could read the refresh token, so the app must stay free of third-party scripts. Two tabs refreshing at once are covered by pibble accepting the previous refresh token for two minutes (I5).
