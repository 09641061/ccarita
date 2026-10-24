---
name: ccarita-feature
description: Step-by-step workflow for adding a screen, flow or use case to the ccarita Angular app — from the product rule and pibble endpoint, through domain, endpoint and assembler, store, view and texts, to tests and docs — so it lands in the right context and layers. Use for any feat or new behavior; use ccarita-fix for defects instead.
---

# Adding a feature to ccarita

Build from the contract inward, then outward to the screen: endpoint and domain first, template last. [ccarita-ddd](../ccarita-ddd/SKILL.md) owns folders and names, and [its templates](../ccarita-ddd/references/templates.md) own the file shapes.

## 1. Place the feature

1. Name what the user does in one sentence ("staff book an appointment from the calendar"), find its rule ids in `../docs/03-business-domain.md` (B1–B9, B16, B17) and check the roles table (§5). If no rule covers it, stop and ask the user instead of inventing one.
2. Find the pibble operations in [api/openapi.json](../../../api/openapi.json): path, method, request and response schema, error responses, `Idempotency-Key`. If the screen needs data pibble does not serve, stop and say so: the fix belongs in pibble, not in a client-side workaround.
3. Pick the context that owns the endpoint ([docs/architecture.md](../../../docs/architecture.md)). Everything you need from another context comes through its `public-api.ts` and must be on the context map.
4. Decide who sees it and what the inactive plan does (O6), with [ccarita-session](../ccarita-session/SKILL.md).
5. Read the existing files of the context and copy their style.

## 2. Domain

1. Add or extend the entity or value object with the fields the screen uses, as readonly properties.
2. Add business methods for each rule the UI must reflect (`canReschedule`, `windowOpen(now)`), with the rule id in TSDoc. They decide what to show or enable; pibble still decides what is allowed.
3. Add the command type the store will take (`BookAppointment`).
4. Test each method with plain Vitest.

## 3. Infrastructure

1. Add the method to the context's `*.api.ts` (create it if the resource is new), typed with `pibble.schema.ts`. POSTs take an `idempotencyKey` and pass `idempotent(key)`.
2. Add assembler functions: resource → domain with `required()` on fields the domain needs, and command → request.
3. Test with `HttpTestingController`: URL, method, body, headers, and the mapped result. Follow [ccarita-api](../ccarita-api/SKILL.md).

## 4. Application

1. Add reads to the store as `rxResource` keyed by the signals they depend on (establishment, date, search text).
2. Add commands as `async` methods taking the domain command and the idempotency key; after success, `reload()` what changed.
3. Test the store against `HttpTestingController`: a key change reloads, a command reloads, an error surfaces as `ApiError`.

## 5. Presentation

1. Add the view under `presentation/views/` and its route in `<context>.routes.ts`; reusable pieces go under `components/`.
2. Render every state: loading, empty, error with retry, no permission, plan inactive, and data. Follow [ccarita-ui](../ccarita-ui/SKILL.md).
3. A form creates one idempotency key when it opens, sends it on submit and on every retry, and creates a new one only after success.
4. Add every text to `public/i18n/es.json` under the context's key (`booking.calendar.empty`); add an `errors.<CODE>` entry for any new pibble code.
5. Export from `public-api.ts` only what another context uses.

## 6. Prove and document

1. Run `pnpm test`, `pnpm arch`, `pnpm lint` and, before the pull request, `pnpm check`.
2. Start pibble (`./mvnw quarkus:dev` in `../pibble`) and the app (`pnpm start`), walk the flow for each role it changes, and save evidence for the Proof block.
3. Update `docs/architecture.md` when you add a context edge or a route branch; record a decision when a choice had real alternatives ([ccarita-docs](../ccarita-docs/SKILL.md)).

## Checklist

- [ ] The rule id and the pibble operation are named; nothing is invented.
- [ ] Resources stop at the assembler; the store exposes domain types and `ApiError`.
- [ ] POSTs carry one idempotency key per user action, reused on retry.
- [ ] All states render, texts are in `es.json`, times use the establishment's zone.
- [ ] Tests cover domain methods, endpoint mapping, store behavior and view states.
