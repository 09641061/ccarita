# Decision: inbox stream through HttpClient

Status: implemented

## Problem

`GET /api/v1/inbox/stream` is server-sent events that need `Authorization` and `X-Organization-Id`, which `EventSource` cannot send. The stream must refresh an expiring token before reconnecting (I5), and `conversations` may not import `iam`, which holds the token.

## Decision

`InboxStreamApi` reads the stream with `HttpClient` (`observe: 'events'`, `reportProgress: true`, `responseType: 'text'`). The app's fetch backend (`withFetch()`) reads the body as a `ReadableStream` and reports the text received so far; `ServerSentEvents` splits the new part into events. The interceptors work as for any call: `authInterceptor` adds the token and refreshes it first when it is about to expire, `tenantInterceptor` adds the organization, and `apiErrorInterceptor` turns a failure into an `ApiError`. Unsubscribing aborts the request.

`InboxStore` reconnects after an error, after pibble closes the stream, and after 60 seconds without an event (pibble pings every 25), waiting 1, 2, 4… up to 30 seconds; the wait resets once a connection delivers an event. After a reconnection it reloads the first page and the open chat, since changes may have been missed. The stream runs while a screen follows it, and restarts when the organization changes.

## Alternatives considered

**`fetch` with the token from `iam`.** Direct, but `conversations` would need an edge to `iam` that pibble's context map does not have, and would repeat the refresh, tenant header and error mapping the interceptors already do.

**`EventSource` with the token in the query string.** pibble does not accept it, and the token would end up in logs.

## Consequences

The stream behaves like every other call in tests (`HttpTestingController` with progress events). Angular keeps the text received so far in memory, which for pings every 25 seconds stays small until the next reconnection.
