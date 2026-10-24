---
name: ccarita-docs
description: Where documentation goes in the ccarita Angular app and how to write it — AGENTS.md instructions, docs/ pages, decision records in docs/decisions, TSDoc, Spanish texts, and commit messages — and how to run scripts/check-docs.sh. Use when a change needs documentation, when recording a design decision with its alternatives, when editing any AGENTS.md or skill, or when check-docs.sh fails.
---

# Ccarita documentation

Everything in the repository is written in **English**: `AGENTS.md`, `README.md`, `docs/`, decision records, skills, code identifiers, TSDoc and commit messages. **What users read is Spanish (Peru)** and lives only in `public/i18n/es.json`. The Takodu product docs (business rules, roles, WhatsApp and assistant design) live outside the repository (`../docs`); cite them by path and rule id, never copy them.

[docs/AGENTS.md](../../../docs/AGENTS.md) is the documentation standard: what each place holds, the writing rules, and the word budgets. Read it before writing; this skill gives the workflow.

## Decide where the fact goes

Every fact has one home; everywhere else links to it.

| The fact is…                                        | Home                                                      |
| --------------------------------------------------- | --------------------------------------------------------- |
| A rule every agent needs in every session           | Root `AGENTS.md`, one to three lines, linking to its home |
| How to build or fix code (layers, names, templates) | A skill in `.agents/skills/`                              |
| A text a user reads                                 | `public/i18n/es.json`                                     |
| An endpoint, field or error code of pibble          | `api/openapi.json` (synced, never hand-edited)            |
| Why a design choice was made and what it beat       | A decision record in `docs/decisions/`                    |
| How the system is organized (contexts, map)         | `docs/architecture.md`                                    |
| A business rule (what the product must do)          | The product docs; the code cites its id (`B3`)            |
| How to run, configure, or deploy                    | `README.md`                                               |
| The contract of a class, function or store          | TSDoc on that declaration                                 |
| What one commit changed                             | The commit subject                                        |
| Why a change was made, and its evidence             | The pull request (Motivation and Proof)                   |

Do not restate a fact in a second place. Search for a distinctive phrase before adding a rule; if it exists, link to it.

## Decision records

Write one only when a choice had real alternatives and someone could reasonably try to reverse it later. Mechanical and local changes do not get one.

- Path: `docs/decisions/<status>/yyyy-mm-dd-topic-in-kebab-case.md`, where `<status>` is `proposed`, `implemented`, or `rejected` and the date is the day the topic was first proposed.
- Header, exactly:

  ```markdown
  # Decision: <title>

  Status: <proposed | implemented | rejected — reason in one line>
  ```

- Required sections: `## Problem` and `## Alternatives considered` always; `## Proposal` and `## Acceptance criteria` in `proposed/` and `rejected/` (proposal only); `## Decision` and `## Consequences` in `implemented/`.
- When a proposal ships, check its acceptance criteria, move the file to `implemented/`, change `Status`, and rewrite `## Proposal` into a present-tense `## Decision` and the criteria into `## Consequences`. When a later decision replaces it, write a new record and link both; never rewrite an implemented record into a different decision.

## Writing rules

- Describe the current state. History lives in commits and decision records, not in "now", "no longer", or "we changed".
- One physical line per paragraph; let the editor wrap.
- Name the exact class, endpoint, or command instead of a metaphor.
- No reasoning transcripts: state the rule and its reason, not how you arrived at it.
- Use bold only for the clause that changes behavior.

## Commits, branches and pull requests

Conventional Commits: `<type>(<scope>): <imperative summary>`. Types: `feat`, `fix`, `refactor`, `test`, `docs`, `build`, `ci`, `chore`, `perf`. The scope is the bounded context (`iam`, `organization`, `customers`, `booking`, `conversations`, `assistant`, `platform`), `shared`, `arch`, or `api` for a contract sync. One logical change per commit, with code and its docs together. No body, or one short line; never a `Co-Authored-By` or other attribution trailer. The `commit-msg` hook and CI run `scripts/check-commit-msg.sh`.

- Branches: `<type>/<topic>` for people; an agent prefixes its name (`claude/feat-calendar`, `codex/fix-inbox-reconnect`), so agent work shows in branch names, not commit metadata. An agent in a parallel git worktree uses the same name for the worktree.
- Pull requests are merged with their commits kept, not squashed, so each commit must pass the checks on its own.
- The pull request carries the motivation, the rule ids, the screens per role and one Proof block per test or manual check (`.github/pull_request_template.md`).
- One pull request at a time into `develop`; never stack pull requests on another feature branch.
- Rewrite pushed history only with `git push --force-with-lease`, never `--force`.

## Check

Run `scripts/check-docs.sh` after editing Markdown or skills. It checks word budgets (`scripts/doc-budgets.tsv`), relative links, decision-record format, and skill front matter. When a budget fails: move content to its proper home, then condense, and raise the ceiling in the same commit only when the content truly needs the space.
