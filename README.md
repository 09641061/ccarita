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
pnpm theme:check    # every M3 color role carries its Takodu token
scripts/check-docs.sh
```

`/dev/ui` (development builds only) shows the theme and every shared component. With `pnpm start` running, `pnpm screenshots` saves it and sign-in at 390 × 844 and 1440 × 900, light and dark, in `screenshots/` (not committed); set `CHROMIUM_PATH` or run `pnpm exec playwright install chromium` first. With pibble in dev mode, `CCARITA_EMAIL=<a user with an organization> PIBBLE_LOG=<pibble's console log> pnpm screenshots` also signs in once with the code pibble prints and saves the picker and the signed-in frame.

To sign in during development, run pibble with `./mvnw quarkus:dev` in `../pibble`: it prints each sign-in code and invitation token in its console instead of emailing them.

## Roadmap

One pull request into `develop` per step, built from the designs in `../ui-reference`:

- **F1** design system and shell (done).
- **F2** sign-in, session, organization picker, establishment switcher, invitation acceptance, guards, roles, plan banner (done).
- **F3** calendar day and week, appointment detail and actions, cancel sheet, time blocks.
- **F4** booking flow.
- **F5** customers.
- **F6** inbox and chat.
- **F7** onboarding and establishment settings.
- **F8** assistant settings and usage.
- **F9** team, invitations, ownership transfer, account sessions, plan.
- **F10** Takodu team area.

Where pibble's API serves less than a design shows, the design adapts:

- The calendar loads customer names with `GET /api/v1/customers/{id}`, cached per customer.
- The customer panel shows no appointments, and there is no "Próxima cita" column.
- Appointments show no notification status.
- The inbox shows a status line instead of a message preview, has no search and no "replying" state, and filters only loaded conversations.
- The customers page has previous and next without a total.
- Staff send text and templates only.
- The navigation shows no unread count.
- The account button shows the user's name, or the email when the user has none: `JoinedOrganization` carries no member display name.
- The plan card names the plan (`standard` or `max`) and its end; pibble has no trial flag, so it never says "Prueba gratis".
- An invitation for another email shows only the signed-in email; pibble does not return the invited one.

Defaults for the designs' open questions: navigation says "Asistente" and the chat signs "Tako"; the week view has one column per day; the cancel sheet says "El cliente"; the renewal contact is `environment.renewalContact`, a placeholder; there is no floating assistant button; sign-in shows the "Takodu" wordmark, because the mascot marks only the assistant; a user without an organization sees an explanation and a link to `/primeros-pasos`, a placeholder until F7.

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
