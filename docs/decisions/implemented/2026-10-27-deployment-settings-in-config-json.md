# Decision: Deployment settings in config.json

Status: implemented

## Problem

The pibble origin, the renewal contact (O5) and Takodu's Meta app for Embedded Signup (W2) differ per deployment and per developer (a tunnel's https origin, a Meta configuration id). Built into `environment.ts`, each change needs a new build, and a developer's Meta ids would end up committed.

## Decision

`main.ts` reads `/config.json` with `loadRuntimeConfig` (`shared/infrastructure/config/runtime-config.ts`) before `bootstrapApplication`, lays it over `environment`, and passes the result to `appConfig(config)`, which provides `API_BASE_URL`, `RENEWAL_CONTACT` and `META_SIGNUP`. A missing or unreadable file, or a missing field, keeps the build's value. `public/config.json` is ignored by git; `public/config.example.json` shows its shape.

## Alternatives considered

**`environment.*.ts` per deployment.** Needs one build per deployment and commits every value.

**`provideAppInitializer` fetching the file.** Tokens such as `API_BASE_URL` are read while providers are created, before an initializer finishes, so they would need a mutable holder.

## Consequences

A deployment changes its settings by replacing one static file. Start-up waits for one small request; offline it falls back to the build's values.
