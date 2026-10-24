---
name: ccarita-ddd
description: The bounded-context and layering standard for the ccarita Angular app — which context, layer, folder and file name a piece of code gets, what it may import, and the shape of domain classes, endpoints, assemblers, stores, views and public-api.ts. Use before creating, moving, renaming or reviewing any file under src/app, including every feature, fix and refactor, and when pnpm arch reports a violation.
---

# Contexts and layers in ccarita

The why is in the [layered contexts decision](../../../docs/decisions/implemented/2026-10-23-layered-bounded-contexts.md); the context table is in [docs/architecture.md](../../../docs/architecture.md). File shapes are in [references/templates.md](references/templates.md).

## Pick the context

The context is the one whose pibble endpoint the screen calls. A calendar is `booking`, the team screen is `organization`, assistant settings are `assistant`, anything under `/internal/v1` is `platform`. A screen that shows data of several contexts lives in the one whose action it performs and imports the others through their `public-api.ts`, along the context map. If no context fits, stop and ask the user.

## Folders and names

```text
src/app/<context>/
  domain/model/<name>.ts                 Appointment, AppointmentStatus, Slot (one concept per file)
  application/<name>.store.ts            CalendarStore (state and use cases of one screen family)
  infrastructure/<resource>.api.ts       AppointmentsApi (one per pibble resource path)
  infrastructure/<name>.assembler.ts     toAppointment, toBookAppointmentRequest
  presentation/<context>.routes.ts       bookingRoutes
  presentation/views/<view>/<view>.ts    Calendar (routed screen; .html and .scss beside it)
  presentation/components/<c>/<c>.ts     AppointmentCard (reusable, inputs and outputs only)
  presentation/guards/<name>.guard.ts    roleGuard (functional route guards)
  public-api.ts                          what other contexts may import
```

- Files are kebab-case without type suffixes for components (`appointment-card.ts`, class `AppointmentCard`), and with `.store`, `.api`, `.assembler`, `.routes`, `.spec` for the rest.
- Selectors start with `app-`. One exported class per file.
- Folders are created when the first file needs them; there are no empty layers.

## What each layer holds

- **domain:** readonly classes and union types with business methods (`appointment.canMarkNoShow(now)`), cite the rule id (`B11`) in TSDoc, no Angular, no RxJS, no `Date.now()` (pass `now` in). Identifiers are `string` UUIDs; instants are `Date`; money is `Money`.
- **infrastructure:** `*.api.ts` injects `HttpClient` and `API_BASE_URL`, types bodies with `pibble.schema.ts`, maps with an assembler and returns `Observable<DomainType>`. No state, no navigation, no error handling beyond what the interceptors do. Interceptors and browser storage also live here.
- **application:** stores own signals, `rxResource` reads and `async` commands; they translate between screens and endpoints and are the only callers of `*.api.ts`.
- **presentation:** views read stores, call commands, navigate and show texts; components get data through `input()` and report through `output()`. Route guards live in `presentation/guards/`, because they read stores.

## Rules `pnpm arch` enforces

| Rule                                                  | Meaning                                          |
| ----------------------------------------------------- | ------------------------------------------------ |
| `domain-is-framework-free`                            | domain imports nothing outside `src/`            |
| `domain-depends-on-no-outer-layer`                    | domain imports only domain                       |
| `infrastructure-ignores-application-and-presentation` | endpoints know no store or screen                |
| `application-ignores-presentation`                    | stores know no component                         |
| `presentation-ignores-infrastructure`                 | components never see HTTP or resources           |
| `generated-schema-stays-in-infrastructure`            | only infrastructure imports `pibble.schema.ts`   |
| `contexts-meet-through-public-api`                    | another context only through its `public-api.ts` |
| `context-map-<context>`                               | only along the map in `.dependency-cruiser.cjs`  |
| `shared-imports-no-context`, `no-circular`            | the kernel stays below everyone; no cycles       |

A violation is fixed by moving code, never by editing the rule. A new edge in the context map needs the table in `docs/architecture.md` changed in the same commit.

## Checklist

- [ ] The file is in the context of the endpoint it serves and in the right layer.
- [ ] Domain classes are readonly, framework-free and cite rule ids.
- [ ] Resources stop at the assembler; stores and views use domain types.
- [ ] Cross-context imports go through `public-api.ts`; `pnpm arch` passes.
