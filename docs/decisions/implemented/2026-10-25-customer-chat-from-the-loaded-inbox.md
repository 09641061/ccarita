# Decision: customer chat from the loaded inbox

Status: implemented

## Problem

The customer panel offers "Ver chat" (W3: one conversation per line and customer). pibble lists conversations only per establishment, newest activity first, a page at a time; it has no lookup by customer, and pibble is not changed for the frontend.

## Decision

`InboxStore.conversationOf(customerId)` searches the conversations already loaded for the selected establishment. `app.routes.ts` passes it to `customers` as `CUSTOMER_ACCESS.chatOf`, beside the role and plan ([member access decision](2026-10-24-member-access-provided-by-the-app-routes.md)). The panel links to `/bandeja/<id>` only when it is found; otherwise it shows no link.

## Alternatives considered

**Paging through the inbox until the customer appears.** Always finds an existing chat, but one panel could read every conversation of the establishment, 30 at a time.

**Linking to `/bandeja?cliente=<id>` and searching there.** The same search behind a link that may lead nowhere.

**Filtering the inbox by customer in pibble.** The right fix, outside this repository.

## Consequences

Opening a customer reads the first inbox page of the selected establishment if the inbox was not loaded yet. A customer whose chat is older than the loaded pages shows no "Ver chat"; the README lists it as an adaptation. If pibble adds a lookup by customer, `conversationOf` calls it and the panel keeps its token.
