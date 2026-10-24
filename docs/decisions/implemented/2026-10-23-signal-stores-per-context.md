# Decision: Signal stores per context

Status: implemented

## Problem

Screens share state (the selected establishment's calendar, the inbox list with live updates) and must show loading, empty, error and retry states consistently. The reference store loads everything in its constructor, keeps one `loading` flag for several collections and retries POSTs, which duplicates bookings when pibble had already accepted the first one.

## Decision

Each context's `application` folder has `@Injectable({ providedIn: 'root' })` stores built on Angular signals. Reads are `rxResource` keyed by signals (the selected establishment, a date), so they load when first read and reload when a key changes, with their own `isLoading` and `error`. Commands are `async` methods that take a domain command and an idempotency key, call the endpoint, update or reload the affected resource, and throw `ApiError`. Components show progress and errors per action and retry with the same key. Templates use the zoneless change detection Angular 22 generates.

## Alternatives considered

**NgRx Store or SignalStore.** Strong patterns for large teams, but actions, reducers and effects (or a plugin layer) for an app whose state is mostly server data with a few selections.

**Services holding subjects** (`BehaviorSubject`). Familiar from older Angular, but every template needs the async pipe and every read hand-written loading flags, which signals and `rxResource` give for free.

## Consequences

A store reads like a list of queries and commands. Server data is reloaded rather than patched by hand, so a write shows what pibble stored. A command's error belongs to the screen that started it.
