# AGENTS.md

Ccarita is the Takodu web app: an Angular 22 single-page app with Angular Material 3, organized in bounded contexts and layers like its backend, pibble (`../pibble` in the workspace). Takodu lets small service businesses in Peru take bookings and answer customers on WhatsApp, with an AI assistant and a shared inbox. Read [docs/architecture.md](docs/architecture.md) before changing `src/app`, and follow [docs/AGENTS.md](docs/AGENTS.md) for documentation.

## Product specification and API

Business rules live outside this repository, in the Takodu product docs (`../docs` in the workspace): `03-business-domain.md` (rules with ids such as `B3` or `W6`, and the roles table in §5), `07-whatsapp-integration.md` and `08-ai-assistant.md`. The API contract is [api/openapi.json](api/openapi.json), copied from pibble; `pnpm api:sync` refreshes it and the generated types. **On business rules the product docs win; on endpoints and fields `api/openapi.json` wins; on code shape this repository wins.**

## Required skills

Skills live in `.agents/skills/` (`.claude/skills` is a symlink to that folder). Load them before acting:

- Any change under `src/app`: [ccarita-ddd](.agents/skills/ccarita-ddd/SKILL.md), which defines contexts, layers, folders and names.
- New screen, flow or use case: [ccarita-feature](.agents/skills/ccarita-feature/SKILL.md).
- Fixing a defect: [ccarita-fix](.agents/skills/ccarita-fix/SKILL.md).
- Calling pibble, mapping resources, errors, idempotency keys or the inbox stream: [ccarita-api](.agents/skills/ccarita-api/SKILL.md).
- Sign-in, tokens, the selected organization or establishment, roles, guards or the inactive plan: [ccarita-session](.agents/skills/ccarita-session/SKILL.md).
- Components, templates, forms, Material, accessibility or texts: [ccarita-ui](.agents/skills/ccarita-ui/SKILL.md).
- Documentation, decisions or commit messages: [ccarita-docs](.agents/skills/ccarita-docs/SKILL.md).

## Commands

```sh
mise install                 # Node and pnpm (pinned in mise.toml)
pnpm install
pnpm start                   # http://localhost:5173, against pibble on http://localhost:8080
pnpm test                    # unit and component tests (Vitest)
pnpm arch                    # layer and context-map rules (dependency-cruiser)
pnpm lint && pnpm format:check
pnpm check                   # everything CI runs, plus the production build
pnpm api:sync                # copy ../pibble/openapi.json and regenerate the API types
scripts/check-docs.sh        # word budgets, links, decision records and skills
git config core.hooksPath .githooks  # enables the local hooks (once per clone)
```

Before pushing, run the evidence that matches the change: tests of the touched store or component, `pnpm arch` if you moved or created files, and `scripts/check-docs.sh` if you touched Markdown. Report only the commands you ran.

## Permanent rules

- **Dependencies point inward:** `presentation → application → infrastructure → domain`. The domain is plain TypeScript, without Angular or RxJS. `pnpm arch` enforces it; fix the placement, never weaken the rule.
- **Contexts meet only through `<context>/public-api.ts`**, and only along the context map in [docs/architecture.md](docs/architecture.md).
- **pibble's types stay in infrastructure.** Resources come from the generated `pibble.schema.ts`; assemblers turn them into domain objects, which are all the rest of the app sees ([decision](docs/decisions/implemented/2026-10-23-api-types-generated-from-pibble.md)).
- **The server decides; the UI explains.** Permissions, plan state and booking rules are enforced by pibble. The UI hides what a role cannot do and shows pibble's error code as a Spanish message, but never re-implements a rule as the only guard.
- **Every POST carries one `Idempotency-Key` per user action**, reused when that action is retried ([ccarita-api](.agents/skills/ccarita-api/SKILL.md)).
- **Tenant and role never come from a form.** The organization is `TenantContext`'s selection; the role comes from pibble.
- **Times are shown in the establishment's time zone**, never the device's; money is integer cents plus currency.
- **Commits:** a Conventional Commits subject with the context as scope (`feat(booking): …`), no body or one short line, no attribution trailers; `scripts/check-commit-msg.sh` enforces it. Reasons and evidence go in the pull request's Proof block.
- **Branches:** `<type>/<topic>`, or `<agent>/<type>-<topic>` for agents; never `--force` ([ccarita-docs](.agents/skills/ccarita-docs/SKILL.md)).
- **Secrets:** the app has none; tokens live only in the browser session ([ccarita-session](.agents/skills/ccarita-session/SKILL.md)).
- **Language:** code, docs, decisions, skills and commits are in English; every text a user reads is Spanish (Peru), in `public/i18n/es.json`.

## Editing these instructions

`CLAUDE.md` is a symlink to this file; edit `AGENTS.md`. Each rule takes one to three lines and links to where it is explained. The word budget is in [scripts/doc-budgets.tsv](scripts/doc-budgets.tsv).
