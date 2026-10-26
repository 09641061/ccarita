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
- **F3** calendar day and week, appointment detail and actions, cancel sheet, time blocks (done).
- **F4** booking flow, customer search and registration, rescheduling (done).
- **F5** customers: list, detail, registration, editing and deletion (done).
- **F6a** inbox, live stream, reading and replying, media (done).
- **F6b** templates in a closed window, assignment, assistant pause and resume, "Ver chat" from the customer.
- **F7** onboarding and establishment settings.
- **F8** assistant settings and usage.
- **F9** team, invitations, ownership transfer, account sessions, plan.
- **F10** Takodu team area.

Where pibble's API serves less than a design shows, the design adapts:

- The calendar loads customer names with `GET /api/v1/customers/{id}`, cached per customer. pibble answers 404 for a deleted customer, so their past appointments say "Cliente eliminado" instead of the name C5 keeps.
- The calendar has no appointment search: pibble has no endpoint for it.
- The cancel sheet says the customer gets a WhatsApp only when the business cancels and the establishment has a line; pibble sends nothing when the customer asked.
- The customer panel shows no appointments, and there is no "Próxima cita" column: pibble lists appointments only per establishment and date range.
- The customer panel has no "Ver chat" until F6b.
- The customers list follows pibble's order by display name, so customers without a name (shown as "Sin nombre") come first, by phone.
- Appointments show no notification status.
- The inbox shows a status line instead of a message preview, has no search and no "replying" state, and filters only loaded conversations, 30 at a time with "Cargar más". It never says the assistant is answering: pibble does not say whether it is on, so an active conversation shows until when the customer can be written to.
- Until F6b, a closed window explains itself and offers nothing to send, the assignee is shown but not chosen, and a handoff shows its summary without "Retomar asistente".
- The customers page has previous and next without a total.
- Staff send text and templates only.
- The navigation shows no unread count.
- Booking offers the slots pibble lists, which start from now; the design draws no direct time, so a walk-in that already started is booked at the next free slot instead of directly (B16).
- The booking day strip marks no closed days until opening hours are read (F7); a closed day says there are no free times.
- Rescheduling lists slots without ignoring the appointment being moved, because the slots endpoint does not; times that overlap its own are not offered, and it shows no "N libres" counts.
- Booking has three steps instead of the design's four: the third ends with the design's "Reservar" button.
- The booking footer says the confirmation goes by WhatsApp only when the establishment has a line (W12); it promises no reminder, which depends on how far ahead the appointment is (W11).
- Customer search shows the first 20 matches and asks to keep typing when there are more.
- The account button shows the user's name, or the email when the user has none: `JoinedOrganization` carries no member display name.
- The plan card names the plan (`standard` or `max`) and its end; pibble has no trial flag, so it never says "Prueba gratis".
- An invitation for another email shows only the signed-in email; pibble does not return the invited one.

Defaults for the designs' open questions: navigation says "Asistente" and the chat signs "Tako"; the week view has one column per day; the cancel sheet says "El cliente"; the renewal contact is `environment.renewalContact`, a placeholder; there is no floating assistant button; sign-in shows the "Takodu" wordmark, because the mascot marks only the assistant; a user without an organization sees an explanation and a link to `/primeros-pasos`, a placeholder until F7; "Cualquiera" in booking lets pibble choose the least busy member (B17), and in rescheduling it is "Mantener a …"; the calendar does not read opening hours until F7, so it marks no closed days or appointments outside them, and the desktop grid shows 08:00 to 20:00, widened to fit what it draws.

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
