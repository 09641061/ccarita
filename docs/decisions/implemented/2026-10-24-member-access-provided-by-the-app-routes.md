# Decision: member access provided by the app routes

Status: implemented

## Problem

The Clientes page hides deleting from staff (C3) and disables booking on an inactive plan (O6). The role and the plan live in `organization` (`CurrentOrganization`), but `customers` imports no other context: the context map follows pibble's, where customers depends on nothing.

## Decision

`customers` declares what it needs as `CUSTOMER_ACCESS` (`customers/application/customer-access.ts`): signals `canDelete` and `canBook`, and `chatOf`, which finds the customer's conversation ([decision](2026-10-25-customer-chat-from-the-loaded-inbox.md)). `app.routes.ts`, the composition root that already imports every context, provides it on the `/clientes` route from `CurrentOrganization.can('deleteCustomers')` and `planActive`. Without a provider the token offers nothing extra (both `false`), and pibble still refuses what a role may not do.

## Alternatives considered

**An edge `customers → organization` in the context map.** One import instead of a token, but the frontend map would stop mirroring pibble's, and every later customers screen could reach into organization's stores.

**Reading the role from `TenantContext`.** The shared kernel would have to hold the role and the plan, which `organization` loads and refreshes; two sources of truth.

## Consequences

`customers` stays a leaf, and its views are tested with a plain object for the token. Another context below `organization` that needs the role does the same: a token in its application layer, provided in `app.routes.ts`.
