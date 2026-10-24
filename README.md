# ccarita

Web app of Takodu: an Angular 22 single-page app with Angular Material 3, organized in bounded contexts and layers like its backend, pibble. Small service businesses in Peru use it to manage their calendar, team, customers, WhatsApp inbox and AI assistant. The architecture is in [docs/architecture.md](docs/architecture.md); instructions for agents and contributors are in [AGENTS.md](AGENTS.md).

## Requirements

- [mise](https://mise.jdx.dev/) for Node and pnpm: `mise install` installs the versions pinned in `mise.toml`.
- pibble running locally for anything beyond the unit tests: `./mvnw quarkus:dev` in `../pibble` serves `http://localhost:8080` and allows browser calls from `http://localhost:5173`.

## Run

```sh
pnpm install
pnpm start          # http://localhost:5173
```

Sign in with any email: pibble's dev mode prints the 6-digit code in its console.

## Checks

```sh
pnpm test           # Vitest
pnpm arch           # layers and context map (dependency-cruiser)
pnpm lint           # ESLint with Angular and accessibility rules
pnpm format:check   # Prettier
pnpm check          # all of the above plus the production build, as CI runs it
scripts/check-docs.sh
```

## API contract

[api/openapi.json](api/openapi.json) is pibble's OpenAPI document, and `src/app/shared/infrastructure/api/pibble.schema.ts` is generated from it ([decision](docs/decisions/implemented/2026-10-23-api-types-generated-from-pibble.md)). After pibble changes its API:

```sh
(cd ../pibble && ./mvnw package -DskipTests -Dquarkus.smallrye-openapi.store-schema-directory=.)
pnpm api:sync
```

CI fails when the generated types do not match `api/openapi.json`.

## Production

`pnpm build` writes a static site to `dist/ccarita/browser`, calling pibble at `apiBaseUrl` in `src/environments/environment.ts`. Serve it from the origin pibble's `APP_URL` names, with every unknown path answered by `index.html`, and a Content Security Policy that allows scripts only from the site itself.

## Local hooks

```sh
git config core.hooksPath .githooks
```

`pre-commit` checks whitespace, documentation and formatting of staged files, `commit-msg` checks the commit message, and `pre-push` runs the architecture rules, lint and tests.
