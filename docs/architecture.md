# Ccarita architecture

Ccarita is one Angular application split into the same bounded contexts as pibble, so a rule, an endpoint and a screen of one business area live under one name. Each context has four layers, and `pnpm arch` (dependency-cruiser, [.dependency-cruiser.cjs](../.dependency-cruiser.cjs)) verifies the layers and the context map. The exact shape of each file is in the [ccarita-ddd](../.agents/skills/ccarita-ddd/SKILL.md) skill; why it is cut this way is in the [layered contexts decision](decisions/implemented/2026-10-23-layered-bounded-contexts.md).

## Contexts

Each context is a folder under `src/app`; `shared` is the kernel and imports no context.

| Context         | Screens                                                                                    | pibble endpoints                                                                                                                        | May import                                              |
| --------------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `shared`        | Shell, no permission, not found                                                            | —                                                                                                                                       | —                                                       |
| `iam`           | Sign-in, account and its devices                                                           | `/api/v1/auth/**`                                                                                                                       | —                                                       |
| `organization`  | Signed-in frame, settings center, organization picker, invitations, onboarding, team, plan | `/api/v1/organizations`, `/organization`, `/establishments`, `/members`, `/services`, `/invitation-acceptances`, `/ownership-transfers` | `iam`                                                   |
| `customers`     | Customer search, detail and form; the names other screens show                             | `/api/v1/customers`                                                                                                                     | —                                                       |
| `booking`       | Calendar, booking and rescheduling, time blocks                                            | `/api/v1/appointments`, `/services/{id}/slots`, `/time-blocks`, `/establishments/{id}/appointments`, `/establishments/{id}/time-blocks` | `organization`, `customers`                             |
| `conversations` | Inbox, conversation, WhatsApp line                                                         | `/api/v1/conversations`, `/inbox/stream`, `/media`, `/establishments/{id}/conversations`, `/establishments/{id}/whatsapp-line`          | `organization`, `customers`, `booking`                  |
| `assistant`     | Assistant settings and usage                                                               | `/api/v1/establishments/{id}/assistant/**`                                                                                              | `organization`, `customers`, `booking`, `conversations` |
| `platform`      | Takodu team: organizations, plan changes, usage                                            | `/internal/v1/**`                                                                                                                       | `iam`                                                   |

`CONTEXT_MAP` in `.dependency-cruiser.cjs` mirrors the "May import" column, which follows pibble's context map. Change the table and the map in the same commit, and a new context needs a decision record.

The shared kernel holds what every context uses: `ApiError`, `Money`, `UsagePeriod`, `LocalDate` (a day of an establishment, turned into instants only through its time zone, [decision](decisions/implemented/2026-10-23-establishment-days-without-a-date-library.md)) and `newIdempotencyKey` (domain); `API_BASE_URL`, the HTTP interceptors, `TenantContext` and the generated `pibble.schema.ts` (infrastructure); `Shell`, the shared components (`StatusBadge`, `StateView`, `BusyButton`, …), `PageNotFound`, `Forbidden`, `safeReturnUrl`, `ErrorMessagePipe` and `ZonedDatePipe` (presentation).

## Layers inside a context

```text
presentation    <context>.routes.ts, views (routed screens), components (reusable pieces), Material, templates, texts
application     stores: signal state, rxResource reads and async commands; the only callers of infrastructure
infrastructure  one *.api.ts per pibble resource, assemblers (resource ↔ domain), interceptors, guards, browser storage
domain          entities and value objects as readonly classes with business methods; plain TypeScript
```

Imports go `presentation → application → infrastructure → domain`, and every layer may import the domain. Components never call `HttpClient` and never see a resource type; endpoints never hold state. `public-api.ts` at the context root lists what other contexts may import: stores, domain types and components.

## A request

A view calls a store method. The store calls its context's `*.api.ts` with an idempotency key for a POST. The interceptors, in order: `authInterceptor` (`iam`) adds the access token to calls to pibble, refreshing it first when about to expire, and on a 401 refreshes once and replays ([decision](decisions/implemented/2026-10-23-session-tokens-in-the-browser.md)); `tenantInterceptor` adds `X-Organization-Id` from `TenantContext`; `idempotencyInterceptor` adds `Idempotency-Key`; `apiErrorInterceptor` turns every failure into an `ApiError` with pibble's code. The assembler maps the response to domain objects, the store updates its signals, and the view renders them, errors through `ErrorMessagePipe`.

## Routes

`/ingresar` (`iam`), `/organizaciones`, `/invitations/:token` and `/primeros-pasos` (`organization`) stand alone, and so does `/platform` (`platformRoutes`) behind `authGuard` and `operatorGuard`, offered through `PLATFORM_ENTRY` ([decision](decisions/implemented/2026-10-26-takodu-team-area-outside-the-workspace.md)). Everything else is a child of `Workspace`, the signed-in frame in `organization`, behind `authGuard` and `organizationGuard`; each destination adds `roleGuard(roles)`, which sends others to `/sin-permiso`. `app.routes.ts` mounts `/agenda` (`bookingRoutes`: `citas/:appointmentId`, `reservar` with `?reprogramar=` or `?cliente=`), `/clientes` (`customersRoutes`, with `CUSTOMER_ACCESS` from the role, plan and inbox, [decision](decisions/implemented/2026-10-24-member-access-provided-by-the-app-routes.md)), `/mensajes` (`conversationsRoutes`) and `/equipo` (`teamRoutes`). Settings are not routes: `?ajustes=<section>` on any of these opens `SettingsCenter` over the screen, and the `Workspace` route provides it the other contexts' screens (`SETTINGS_SCREENS`); `SettingsLink` (`shared`) links to a section from any context ([decision](decisions/implemented/2026-10-26-settings-center-and-trimmed-navigation.md)). Development-only screens (`/dev/ui`) are in `dev.routes.ts`, empty in production builds.

## Live inbox

`conversations` follows `GET /api/v1/inbox/stream` (server-sent events) through `HttpClient`, whose interceptors add the token and tenant ([decision](decisions/implemented/2026-10-24-inbox-stream-through-http-client.md)). The store updates each changed row from the event's summary, reloads the list after reconnecting, shows the assistant typing, and tells open calendars of appointment changes through `APPOINTMENT_CHANGES` (`shared`).
