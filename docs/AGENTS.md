# AGENTS.md — Documentation standard

This file defines where each kind of information lives, how it is written and the word budgets. The [ccarita-docs](../.agents/skills/ccarita-docs/SKILL.md) skill gives the workflow.

## One home per fact

Each fact has a single home; everywhere else links to it.

| Place                                            | Contains                                                                                  | Does not contain                                          |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Root `AGENTS.md`                                 | Rules an agent needs in every session, one to three lines each, with a link               | Examples, procedures, content repeated from another place |
| `docs/AGENTS.md`                                 | This standard                                                                             | Code rules                                                |
| `docs/architecture.md`                           | Context map, layers and how they relate                                                   | Class templates, reasons for decisions                    |
| `docs/decisions/`                                | Why something was chosen and which alternatives lost                                      | Plans once implemented, step-by-step instructions         |
| `.agents/skills/`                                | Workflows and code standards                                                              | Deployment data, history                                  |
| `README.md`                                      | How to run, configure and deploy                                                          | Architecture rules                                        |
| `api/openapi.json`                               | pibble's API contract, copied by `pnpm api:sync`                                          | Hand edits                                                |
| TSDoc                                            | The contract of a class, function or store, citing the product rule id it reflects (`B3`) | Narration of the code or its history                      |
| Product docs (`../docs`, outside the repository) | Business rules, roles, WhatsApp and assistant design                                      | Folder layout, code conventions                           |

Business rules are not copied into this repository: cite their id (`W6`) and implement them. When a context is built, its code and TSDoc become the home of its shape.

## Writing rules

- **Describe the current state.** History lives in commits and decision records; avoid "now", "no longer" and "we changed".
- **One paragraph per physical line.** Let the editor wrap; tables, lists and code blocks keep their format.
- **Exact names.** Write the concrete class, endpoint or command instead of a metaphor.
- **No reasoning transcripts.** Write the rule and its reason, not the path that led to it.
- **Sparse emphasis.** Use bold only for the clause that changes behavior.
- **Relative links** to repository files; `scripts/check-docs.sh` verifies they exist. Refer to the product docs by path in code format, not by link, because they live outside the repository.

## Junk list

Find and remove this in any document:

- Duplicated rules: search for a distinctive phrase, keep one home and link the rest.
- Status annotations ("implemented", "future: …"): the code and the decision folders already say it.
- Hand-written inventories of classes, endpoints or tests that the code already shows.
- Paragraphs that mix several rules with parentheses: split them or move the detail to its home.
- Plan language ("will be done", "should") in an implemented decision.

## Word budgets

[scripts/doc-budgets.tsv](../scripts/doc-budgets.tsv) sets the maximum words of the permanent documents, and `scripts/check-docs.sh` rejects the excess. When it fails:

1. **Move** what belongs elsewhere and leave a link.
2. **Condense** what belongs here but can be shorter.
3. **Raise** the limit only if the content needs it, and explain why in the pull request.
