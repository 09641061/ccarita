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

### Settings per deployment

`public/config.json` (ignored by git; copy `public/config.example.json`) overrides `src/environments/environment.ts` at start-up: `apiBaseUrl`, `renewalContact` (a placeholder until Takodu names the channel) and `metaSignup` (`appId`, `configId`, `graphVersion`). Without `metaSignup`, connecting WhatsApp says it is not set up, and development builds offer a test form against pibble's fake line ([decision](docs/decisions/implemented/2026-10-27-deployment-settings-in-config-json.md)).

### WhatsApp with Meta

Connecting a real number runs Meta's Embedded Signup in coexistence: the owner signs in with Facebook and scans a QR from the WhatsApp Business app. It needs:

1. pibble started with `TAKODU_META_ENABLED=true`, `META_APP_ID`, `META_APP_SECRET`, `META_WEBHOOK_VERIFY_TOKEN` and `TOKEN_ENCRYPTION_KEY`.
2. A Facebook Login for Business configuration of type WhatsApp Embedded Signup; its id is `metaSignup.configId`.
3. https for both apps. With Mullvad or another VPN on, run the tunnels outside it:

   ```sh
   mullvad-exclude cloudflared tunnel --protocol http2 --http-host-header localhost:5173 --url http://127.0.0.1:5173
   mullvad-exclude cloudflared tunnel --protocol http2 --http-host-header localhost:8080 --url http://127.0.0.1:8080
   ```

4. pibble restarted with `TAKODU_APP_URL=https://<app tunnel>`, so its CORS admits the app; the app tunnel's domain in the Meta app's App domains and in Facebook Login's allowed domains for the JavaScript SDK; `apiBaseUrl` set to the pibble tunnel; and the webhook `https://<pibble tunnel>/webhooks/whatsapp` with the verify token, subscribed to `messages`.

Each establishment has one line. Quick tunnels get a new domain on every start, so steps 4 repeat.

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
- **F3** calendar day and week, appointment detail and actions, cancel dialog, time blocks (done).
- **F4** booking flow, customer search and registration, rescheduling (done).
- **F5** customers: list, detail, registration, editing and deletion (done).
- **F6a** inbox, live stream, reading and replying, media (done).
- **F6b** templates, assignment, assistant pause and resume, "Ver chat" from the customer (done).
- **F7** onboarding and establishment settings (done).
- **F8** assistant settings and usage (done).
- **F9** team, invitations, ownership transfer, account sessions, organization and plan (done).
- **F10** Takodu team area (done).
- **Alignment** settings center and profile menu, Claude-like (done).

Where pibble's API serves less than a design shows, the design adapts:

- The calendar loads customer names with `GET /api/v1/customers/{id}`, cached per customer. pibble answers 404 for a deleted customer, so their past appointments say "Cliente eliminado" instead of the name C5 keeps.
- The calendar has no appointment search: pibble has no endpoint for it.
- The cancel dialog says the customer gets a WhatsApp only when the business cancels and the establishment has a line; pibble sends nothing when the customer asked.
- The customer panel shows no appointments, and there is no "Próxima cita" column: pibble lists appointments only per establishment and date range.
- The customer panel shows "Ver chat" only when the customer's conversation is among the inbox conversations already loaded for the selected establishment: pibble has no lookup by customer ([decision](docs/decisions/implemented/2026-10-25-customer-chat-from-the-loaded-inbox.md)).
- The customers list follows pibble's order by display name, so customers without a name (shown as "Sin nombre") come first, by phone.
- Appointments show no notification status.
- The inbox shows a status line instead of a message preview, has no search and no "replying" state, and filters only loaded conversations, 30 at a time with "Cargar más". It never says the assistant is answering: the inbox does not read the assistant's settings, so an active conversation shows until when the customer can be written to.
- Reminders and confirmations offer the customer's confirmed appointments of the next 42 days, the most pibble's calendar lists at once, since it has no per-customer read for members. With several, a menu picks the appointment instead of one card per appointment. Inside the window a confirmation goes as normal text, so it needs no approval.
- The assistant button pauses an active assistant and resumes a paused one, offered whether or not the assistant is turned on: its settings are readable only by owners and managers, while staff use the chat too.
- Primeros pasos has four steps (hours, services, WhatsApp, assistant) instead of five: inviting the team is done from Equipo. A step is done when pibble reports it, and only owners walk it.
- Settings, the organization and the account are sections of a settings center opened from the profile menu over the current screen (`?ajustes=<section>`), and the navigation shows only Calendario, Mensajes, Clientes and Equipo, unlike Mapa por rol ([decision](docs/decisions/implemented/2026-10-26-settings-center-and-trimmed-navigation.md)). Managers see Cuenta, Horario, Servicios, Asistente and Uso; staff, Cuenta.
- Opening, editing and archiving establishments share the Locales section, each edited in its own row; the business name is in Cuenta and the plan in Facturación ([decision](docs/decisions/implemented/2026-10-26-settings-center-and-trimmed-navigation.md)).
- Connecting WhatsApp needs Takodu's Meta app (`environment.metaSignup`), which is not set up: the screen says so, and development builds offer a labelled form with the values pibble's dev mode accepts ([decision](docs/decisions/implemented/2026-10-26-embedded-signup-behind-a-setting.md)).
- The assistant has no navigation entry until it becomes a chat; its settings and usage are sections of the settings center.
- The assistant's status card says "Respondiendo en WhatsApp" from the switch, the line and the plan; pibble tells nothing more, so it cannot say which chats it is quiet in.
- Assistant usage lists only the days with answered turns, newest first, as pibble sends them, with the period's total; tokens, never costs. The period is two date inputs instead of a range button.
- The time zone of an establishment is chosen among the Americas' IANA zones.
- The customers page has previous and next without a total.
- Staff send text and templates only.
- The navigation shows no unread count.
- Booking offers the slots pibble lists, which start from now; the design draws no direct time, so a walk-in that already started is booked at the next free slot instead of directly (B16).
- The calendar does not read opening hours, so it marks no closed days or appointments outside them; booking's day strip marks closed days.
- Rescheduling lists slots without ignoring the appointment being moved, because the slots endpoint does not; times that overlap its own are not offered, and it shows no "N libres" counts.
- Booking has three steps instead of the design's four: the third ends with the design's "Reservar" button.
- The booking footer says the confirmation goes by WhatsApp only when the establishment has a line (W12); it promises no reminder, which depends on how far ahead the appointment is (W11).
- Customer search shows the first 20 matches and asks to keep typing when there are more.
- The profile button and Cuenta show the name the organization knows the user by (the member's, from `/api/v1/members`), since pibble lets nobody edit their account's own name; the email shows inside the menu. Its menu's "Ayuda", "Subir plan" and "Aprender más" are disabled placeholders: Takodu has no help center, self-service payment or learning page yet.
- The Takodu team area (`/platform`) has no design; it follows Facturación and Equipo. Operators reach it from the profile menu, Cuenta and the organization picker, outside the workspace, and read plan dates in Lima ([decision](docs/decisions/implemented/2026-10-26-takodu-team-area-outside-the-workspace.md)). pibble serves no single organization, so its page comes from the list, and usage shows each establishment's totals with its count of days, not each day.
- The profile button and Facturación name the plan (`standard` or `max`), and Facturación its end; pibble has no trial flag, so they never say "Prueba gratis", and no self-service payment, so renewing is a message to `renewalContact`; "Subir plan" in the profile menu opens Facturación.
- Equipo shows "Todos los locales" for owners and managers, whom pibble assigns to none (O13), and states in the establishment's zone. A manager may invite and edit managers and staff, as pibble allows; the page leaves the owner's row to the owner, and nobody changes their own role or removes themselves there, which pibble would allow.
- Cuenta shows the user's email and the name they signed in with, read-only: pibble has no endpoint to edit the user, and member names are changed in Equipo. Devices are "Este dispositivo" or "Otro dispositivo": pibble names no device or browser.
- An invitation for another email shows only the signed-in email; pibble does not return the invited one.

Defaults for the designs' open questions: the assistant's settings say "Asistente" and the chat signs "Tako"; the week view has one column per day; the cancel dialog says "El cliente"; the renewal contact is `renewalContact`, a placeholder; there is no floating assistant button; sign-in shows the "Takodu" wordmark, because the mascot marks only the assistant; a user without an organization sees an explanation and a link to `/primeros-pasos`, where they create one; "Cualquiera" in booking lets pibble choose the least busy member (B17), and in rescheduling it is "Mantener a …"; the desktop calendar grid shows 08:00 to 20:00, widened to fit what it draws.

## API contract

[api/openapi.json](api/openapi.json) is pibble's OpenAPI document, and `src/app/shared/infrastructure/api/pibble.schema.ts` is generated from it ([decision](docs/decisions/implemented/2026-10-23-api-types-generated-from-pibble.md)). After pibble changes its API:

```sh
(cd ../pibble && ./mvnw package -DskipTests -Dquarkus.smallrye-openapi.store-schema-directory=.)
pnpm api:sync
```

CI fails when the generated types do not match `api/openapi.json`.

## Production

`pnpm build` writes a static site to `dist/ccarita/browser`, calling pibble at the `apiBaseUrl` of `public/config.json`, or of `src/environments/environment.ts` without it. Serve it from the origin pibble's `APP_URL` names, with every unknown path answered by `index.html`, and a Content Security Policy that allows scripts only from the site itself, plus `https://connect.facebook.net` once `metaSignup` is set.

## Local hooks

```sh
git config core.hooksPath .githooks
```

`pre-commit` checks whitespace, documentation and formatting of staged files, `commit-msg` checks the commit message, and `pre-push` runs the architecture rules, lint and tests.
