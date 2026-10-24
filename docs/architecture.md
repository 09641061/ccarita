# Ccarita architecture

Ccarita is one Angular application split into the same bounded contexts as pibble, so a rule, an endpoint and a screen of one business area live under one name. Each context has four layers, and `pnpm arch` (dependency-cruiser, [.dependency-cruiser.cjs](../.dependency-cruiser.cjs)) verifies the layers and the context map. The exact shape of each file is in the [ccarita-ddd](../.agents/skills/ccarita-ddd/SKILL.md) skill; why it is cut this way is in the [layered contexts decision](decisions/implemented/2026-10-23-layered-bounded-contexts.md).

## Contexts

Each context is a folder under `src/app`; `shared` is the kernel and imports no context.

| Context         | Screens                                                                                   | pibble endpoints                                                                                                                        | May import                                              |
| --------------- | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `shared`        | Shell, "Más", no permission, not found                                                    | —                                                                                                                                       | —                                                       |
| `iam`           | Sign-in, sessions                                                                         | `/api/v1/auth/**`                                                                                                                       | —                                                       |
| `organization`  | Signed-in frame, organization picker, invitations, onboarding, establishments, team, plan | `/api/v1/organizations`, `/organization`, `/establishments`, `/members`, `/services`, `/invitation-acceptances`, `/ownership-transfers` | `iam`                                                   |
| `customers`     | Customer search, detail and form; the names other screens show                            | `/api/v1/customers`                                                                                                                     | —                                                       |
| `booking`       | Calendar, booking and rescheduling, time blocks                                           | `/api/v1/appointments`, `/services/{id}/slots`, `/time-blocks`, `/establishments/{id}/appointments`, `/establishments/{id}/time-blocks` | `organization`, `customers`                             |
| `conversations` | Inbox, conversation, WhatsApp line                                                        | `/api/v1/conversations`, `/inbox/stream`, `/media`, `/establishments/{id}/conversations`, `/establishments/{id}/whatsapp-line`          | `organization`, `customers`, `booking`                  |
| `assistant`     | Assistant settings and usage                                                              | `/api/v1/establishments/{id}/assistant/**`                                                                                              | `organization`, `customers`, `booking`, `conversations` |
| `platform`      | Takodu team: organizations, plan changes, usage                                           | `/internal/v1/**`                                                                                                                       | `iam`                                                   |

`CONTEXT_MAP` in `.dependency-cruiser.cjs` mirrors the "May import" column, which follows pibble's context map; `platform` is the frontend home of pibble's internal API, which serves one audience. Change the table and the map in the same commit, and a new context needs a decision record.

The shared kernel holds what every context uses: `ApiError`, `Money`, `LocalDate` (a day of an establishment, turned into instants only through its time zone, [decision](decisions/implemented/2026-10-23-establishment-days-without-a-date-library.md)) and `newIdempotencyKey` (domain); `API_BASE_URL`, the HTTP interceptors, `TenantContext` and the generated `pibble.schema.ts` (infrastructure); `Shell`, the shared components (`StatusBadge`, `StateView`, `BusyButton`, …), `PageNotFound`, `Forbidden`, `safeReturnUrl`, `ErrorMessagePipe` and `ZonedDatePipe` (presentation).

## Layers inside a context

```text
presentation    <context>.routes.ts, views (routed screens), components (reusable pieces), Material, templates, texts
application     stores: signal state, rxResource reads and async commands; the only callers of infrastructure
infrastructure  one *.api.ts per pibble resource, assemblers (resource ↔ domain), interceptors, guards, browser storage
domain          entities and value objects as readonly classes with business methods; plain TypeScript
```

Imports go `presentation → application → infrastructure → domain`, and every layer may import the domain. Components never call `HttpClient` and never see a resource type; endpoints never hold state. `public-api.ts` at the context root lists what other contexts may import: stores, domain types and components.

## A request

A view calls a store method. The store calls its context's `*.api.ts` with an idempotency key for a POST. The interceptors, in order: `authInterceptor` (`iam`) adds the access token to calls to pibble, refreshing it first when it is about to expire, and on a 401 refreshes once and replays ([decision](decisions/implemented/2026-10-23-session-tokens-in-the-browser.md)); `tenantInterceptor` adds `X-Organization-Id` from `TenantContext`; `idempotencyInterceptor` adds `Idempotency-Key`; `apiErrorInterceptor` turns every failure into an `ApiError` with pibble's code. The assembler turns the response into domain objects, the store updates its signals, and the view renders them, showing an error through `ErrorMessagePipe`.

## Routes

`/ingresar` (`iam`), `/organizaciones` and `/invitations/:token` (`organization`) stand alone. Everything else is a child of `Workspace`, the signed-in frame in `organization`, behind `authGuard` and `organizationGuard`; destinations only some roles see add `roleGuard(roles)`, which sends others to `/sin-permiso`. `app.routes.ts` lazy-loads one `<context>.routes.ts` per context among those children: `/agenda` is `bookingRoutes`, with an appointment's detail as its child `citas/:appointmentId` and booking beside them at `reservar` (`?reprogramar=<id>` reschedules, `?cliente=<id>` preselects); `/clientes` is `customersRoutes`, with `nuevo`, `:customerId` and `:customerId/editar` as children, and `CUSTOMER_ACCESS` provided from the role and plan ([decision](decisions/implemented/2026-10-24-member-access-provided-by-the-app-routes.md)). `platform` has its own branch under `/platform`, guarded by the operator check. Development-only screens, such as the style guide at `/dev/ui`, are in `dev.routes.ts`, which production builds replace with an empty list.

## Live inbox

`conversations` follows `GET /api/v1/inbox/stream` (server-sent events) with `fetch`, because `EventSource` cannot send the `Authorization` header. Each event names a changed conversation; the store reloads it, and after a drop it reconnects and reloads the list ([ccarita-api](../.agents/skills/ccarita-api/SKILL.md)).
