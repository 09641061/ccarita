---
name: ccarita-fix
description: Workflow for fixing a defect in the ccarita Angular app without breaking its layers — reproduce it with a failing test, decide whether the fault is in ccarita or in pibble, fix it in the layer that owns it, and prove it. Use for any bug, wrong screen state, wrong time or money, broken request, or regression; use ccarita-feature when the change adds behavior.
---

# Fixing a defect in ccarita

## 1. Reproduce

1. Write down the steps, the role, the expected and the actual result, and the rule id if one applies.
2. Look at the HTTP exchange in the browser's network panel: request URL, headers (`Authorization`, `X-Organization-Id`, `Idempotency-Key`), body and pibble's answer with its `code`.
3. Decide where the fault is:
   - **pibble answered wrong** for a correct request (wrong data, wrong status, missing field): the fix belongs in pibble. Stop, describe the exchange, and fix it there with its `takodu-fix` skill, or tell the user.
   - **The contract changed** (`api/openapi.json` is older than pibble): run `pnpm api:sync`, fix the type errors, and treat it as a contract update.
   - **ccarita sent or showed it wrong:** continue.

## 2. Find the owning layer

| Symptom                                                                          | Layer                                       |
| -------------------------------------------------------------------------------- | ------------------------------------------- |
| Wrong URL, header, body or query                                                 | infrastructure (`*.api.ts`, interceptor)    |
| A field missing or misread from the response                                     | infrastructure (assembler)                  |
| A wrong rule-derived answer (`canReschedule`, window open)                       | domain                                      |
| Stale data, double loading, an error lost, a retry sending twice                 | application (store)                         |
| Wrong state shown, missing text, wrong time zone or format, inaccessible control | presentation                                |
| A guard lets in or keeps out the wrong role                                      | infrastructure (guard) or the session store |

## 3. Fix with a failing test first

1. Write the test in the owning layer's spec: domain with plain Vitest, endpoint and store with `HttpTestingController`, view with `TestBed` and a stubbed store. See it fail for the reported reason.
2. Fix the code in that layer only. Do not patch a symptom in the template when the store holds the wrong value, and do not add a client-side rule to hide a pibble defect.
3. Run `pnpm test`, `pnpm arch` and `pnpm lint`.

## 4. Prove

- Repeat the reproduction steps against `pibble` in dev mode and save the evidence (screenshot path, network exchange) for the Proof block.
- Commit as `fix(<context>): <what now works>` with the test and the fix together.

## Checklist

- [ ] The fault is placed in ccarita, not in pibble or the contract.
- [ ] A test failed before the fix and passes after.
- [ ] The fix sits in the owning layer; `pnpm arch` passes.
