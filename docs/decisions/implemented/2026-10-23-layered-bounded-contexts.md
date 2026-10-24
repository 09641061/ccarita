# Decision: Layered bounded contexts in Angular

Status: implemented

## Problem

The web app covers the same business areas as pibble: sign-in, team and settings, customers, the calendar, the inbox, the assistant and the Takodu team's tools. Agents and students build it screen by screen. Without fixed boundaries, HTTP calls, state and rules spread into components, and a rename in pibble touches files all over the app.

## Decision

`src/app` has one folder per pibble context (`iam`, `organization`, `customers`, `booking`, `conversations`, `assistant`) plus `platform` for the internal API and `shared` as the kernel. Each context has `domain`, `application`, `infrastructure` and `presentation` folders, as in the ACME learning-center reference, with imports going `presentation → application → infrastructure → domain`. Another context is reached only through its `public-api.ts`, and only along the context map in [architecture.md](../../architecture.md). dependency-cruiser checks all of it in `pnpm arch`, the pre-push hook and CI.

## Alternatives considered

**Feature folders without layers** (`appointments/`, `inbox/`). Fewer files, but components end up calling `HttpClient` and holding resource types, which is what the layers prevent.

**Application ports implemented by infrastructure**, as in pibble (`application → domain ← infrastructure`). Cleaner inversion, but each endpoint needs an abstract class, a provider and an implementation for an app with one backend; stores import their context's `*.api.ts` directly, and tests replace it with `HttpTestingController`.

**An Nx monorepo with one library per context.** Library boundaries enforce imports too, but the tooling is heavier than one app needs, and dependency-cruiser gives the same guarantees with one configuration file.

## Consequences

A screen's code is found by its context and layer, and pibble's names (`Appointment`, `ScheduledMessage`) mean the same in both repositories. Cross-context features (booking from a conversation) go through `public-api.ts`, which makes the dependency visible in review. A one-field change still crosses resource, assembler, domain and template.
