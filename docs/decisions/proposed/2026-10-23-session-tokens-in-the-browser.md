# Decision: Session tokens in the browser

Status: proposed

## Problem

pibble returns an access token (15 minutes) and a refresh token (30 days, rotated on every use, I5) in the body of `POST /api/v1/auth/sessions`. Staff on a shared phone or a salon computer should stay signed in for days, but a token readable by injected script would let an attacker act as them.

## Proposal

`iam` keeps the access token only in memory and the refresh token in `localStorage`, under one key. On start and on a 401, one refresh call (`POST /api/v1/auth/session-refreshes`) runs at a time; concurrent requests wait for it and are sent again once. A failed refresh (`REFRESH_TOKEN_INVALID`) clears the session and returns to sign-in. Signing out deletes the session in pibble (`DELETE /api/v1/auth/sessions/{id}`) and clears storage and `TenantContext`. The app loads no third-party script, and the production host sends a strict Content Security Policy.

## Alternatives considered

**Both tokens in memory.** Safest against script, but every reload or new tab signs the user out, which a salon cannot live with.

**`sessionStorage`.** Survives reloads, but not a closed tab, so staff sign in every morning.

**An `HttpOnly` cookie set by pibble.** Out of reach for script, but pibble answers with JSON tokens and has no cookie or CSRF handling; it is the way to go if pibble adds them.

## Acceptance criteria

- A reload keeps the user signed in; a 401 refreshes once and replays the request.
- Two requests failing at the same time cause one refresh.
- A failed refresh and sign-out leave no token in storage.
