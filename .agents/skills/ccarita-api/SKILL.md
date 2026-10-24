---
name: ccarita-api
description: How the ccarita Angular app talks to pibble — the api/openapi.json contract and generated pibble.schema.ts types, pnpm api:sync, one *.api.ts endpoint per resource with assemblers, idempotency keys, the interceptor chain, ApiError codes and their Spanish messages, pagination, dates and time zones, media downloads, and the server-sent inbox stream over fetch. Use whenever code calls pibble, maps a resource, handles an API error, or the contract changes.
---

# Calling pibble from ccarita

The contract is [api/openapi.json](../../../api/openapi.json) ([decision](../../../docs/decisions/implemented/2026-10-23-api-types-generated-from-pibble.md)). File shapes are in [ccarita-ddd templates](../ccarita-ddd/references/templates.md).

## The contract

- `pnpm api:sync` copies `../pibble/openapi.json` (pibble writes it with `./mvnw package -DskipTests -Dquarkus.smallrye-openapi.store-schema-directory=.`) into `api/` and regenerates `src/app/shared/infrastructure/api/pibble.schema.ts`. Never edit either file by hand; commit them together as `chore(api): sync the pibble contract`.
- Import schema types by name: `import type { Appointment as AppointmentResource } from '…/pibble.schema'`. Alias them `*Resource` so they never mix with domain classes.
- Every generated property is optional because pibble marks none as required. Assemblers wrap fields the domain needs in `required(value, 'Schema.field')`, and give documented defaults only where pibble documents one.

## Endpoints

- One `@Injectable({ providedIn: 'root' })` class per pibble resource path, named after it (`AppointmentsApi`, `ConversationsApi`), with `HttpClient` and `API_BASE_URL` injected. Methods return `Observable<DomainType>` and are named for the action (`book`, `cancel`, `listForEstablishment`), not for HTTP verbs.
- Build URLs as `` `${this.baseUrl}/api/v1/…` ``, and query parameters with the `params` option, never by string concatenation.
- pibble's actions are resources: cancelling is `POST /appointments/{id}/cancellations`, archiving is `POST /establishments/{id}/archivals`. Do not invent `PATCH` or `DELETE` where the contract has a `POST`.

## Idempotency keys

Every POST in the contract with an `Idempotency-Key` parameter gets one, through `idempotent(key)` in the request `context`.

- The **view** creates the key with `newIdempotencyKey()` when the user starts the action (a dialog opens, a reply is typed), passes it to the store on submit, passes the **same** key when the user taps retry after a timeout or `NETWORK_ERROR`, and creates a new one only after success or when the input changes.
- Stores never retry POSTs on their own and never use RxJS `retry` on writes.

## Interceptors and errors

The order is in [docs/architecture.md](../../../docs/architecture.md). `apiErrorInterceptor` makes every failure an `ApiError` (`shared/domain/model/api-error.ts`): `status`, pibble's `code`, and `retryable` for network and 5xx errors.

| Status | Codes (examples)                                                     | Screen behavior                                                                  |
| ------ | -------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| 0      | `NETWORK_ERROR`                                                      | Message plus retry with the same key                                             |
| 400    | `VALIDATION_ERROR`                                                   | Mark the form; Quarkus validation bodies may have no `code`                      |
| 401    | `UNAUTHENTICATED`, `REFRESH_TOKEN_INVALID`                           | The `iam` interceptor refreshes once, then signs out                             |
| 402    | `PLAN_INACTIVE`                                                      | The plan banner; disable writes ([ccarita-session](../ccarita-session/SKILL.md)) |
| 403    | `ACCESS_DENIED`                                                      | No-permission state                                                              |
| 404    | `*_NOT_FOUND`, `MEDIA_REMOVED`                                       | Not-found state or "removed"                                                     |
| 409    | `SLOT_UNAVAILABLE`, `MEDIA_NOT_READY`, `*_CONFLICT`                  | Message; reload the affected data                                                |
| 422    | `OUTSIDE_OPENING_HOURS`, `WINDOW_CLOSED`, `CUSTOMER_CHANGE_TOO_LATE` | Message next to the action                                                       |
| 429    | `LOGIN_CODE_LIMIT`                                                   | Message; no automatic retry                                                      |

Show errors with `ErrorMessagePipe`, which reads `errors.<CODE>` from `public/i18n/es.json`. A new code in pibble gets an entry there in the same commit. Never show `error.message` to users.

## Data formats

- Instants (`start`, `occurredAt`) are ISO strings in UTC: `new Date(value)` in the assembler, `toISOString()` in requests.
- `LocalDate` (`2026-11-02`) and `LocalTime` (`09:30`) belong to the establishment's time zone; keep them as strings or small value objects, never convert them through the device's zone. Display with `DatePipe` and the establishment's `timeZone`.
- Money is `priceCents` + `currency` → `Money`.
- Pages: customers use `page` and `size`; conversations use `cursor` and `size` (`nextCursor` in the answer); messages use `before` and `size`.

## Media

`GET /api/v1/media/{messageId}` needs the token, so an `<img src>` cannot load it directly. Fetch it with `HttpClient` (`responseType: 'blob'`), show it through `URL.createObjectURL`, and revoke the URL on destroy. `MEDIA_NOT_READY`, `MEDIA_DOWNLOAD_FAILED` and `MEDIA_REMOVED` are states of the message, not failures of the screen.

## Inbox stream

`GET /api/v1/inbox/stream` is server-sent events that need `Authorization` and `X-Organization-Id`, which `EventSource` cannot send. `conversations` reads it with `fetch` and a `ReadableStream` text decoder, parsing `data:` lines as `InboxChange` (`type`, `conversationId`, `establishmentId`). The first event is a `ping` meaning subscribed; pings repeat every 25 seconds. On each change the store reloads that conversation; on a drop or a missing ping for 60 seconds it reconnects with backoff and reloads the list. It refreshes the token through the session before reconnecting.

## Tests

- `provideHttpClient(withInterceptors([...]))`, `provideHttpClientTesting()` and `{ provide: API_BASE_URL, useValue: 'http://api.test' }`.
- Assert method, URL, query, body and `Idempotency-Key`; flush pibble-shaped JSON (copy from the schema's examples); assert the domain result or the `ApiError` code.

## Checklist

- [ ] Types come from `pibble.schema.ts`; resources stop at the assembler.
- [ ] Each POST with `Idempotency-Key` in the contract sends one per user action.
- [ ] Every new error code has a Spanish message; no `message` reaches the screen.
- [ ] Instants, local dates and money keep their meaning across the boundary.
