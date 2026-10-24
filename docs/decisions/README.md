# Decisions

A decision record keeps why something was chosen and which alternatives lost: what the code cannot say. Write one only when the choice had real alternatives and someone could try to reverse it; mechanical or local changes do not need one.

## Location and name

`docs/decisions/<status>/yyyy-mm-dd-topic-in-kebab-case.md`. The date is the day the topic was first proposed. The folder is the status, and the file moves when the status changes:

- `proposed/`: reviewed and agreed before implementation; not built yet.
- `implemented/`: the decision is in the code. The file describes what exists, in the present tense, and is updated in the same commit when the code moves or renames something it mentions.
- `rejected/`: considered and discarded. It is kept while it prevents a tempting mistake.

## Format

The first three lines are exactly:

```markdown
# Decision: <title>

Status: <proposed | implemented | rejected — reason in one line>
```

The status must match the folder. Required sections:

| Folder         | Sections                                                                            |
| -------------- | ----------------------------------------------------------------------------------- |
| `proposed/`    | `## Problem`, `## Proposal`, `## Alternatives considered`, `## Acceptance criteria` |
| `implemented/` | `## Problem`, `## Decision`, `## Alternatives considered`, `## Consequences`        |
| `rejected/`    | `## Problem`, `## Proposal`, `## Alternatives considered`                           |

`## Alternatives considered` has one paragraph per real alternative, with the reason it lost. `## Consequences` says what the decision cost and what it gained. `scripts/check-docs.sh` checks the header, the status and the sections.

## Replacements

An implemented decision is never rewritten to say the opposite. If another one replaces it, create a new record and link both.
