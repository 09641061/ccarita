# Decision: Establishment days without a date library

Status: implemented

## Problem

The calendar works in the establishment's IANA time zone (`America/Lima`), not the device's: which appointments fall on "Friday", where a week starts, and which instant a typed "18:00" means. pibble sends instants in UTC and takes instants back; the time zone is a field of the establishment. JavaScript's `Date` only knows UTC and the device zone, and Angular's `DatePipe` ignores IANA names.

## Decision

`LocalDate` (`shared/domain/model/local-date.ts`) is a day of an establishment. It is created from text (`2026-10-23`) or from an instant and a zone, steps by days, finds its Monday, and becomes an instant only through `atTime(time, zone)` or `startIn(zone)`. The zone offset comes from `Intl.DateTimeFormat`, so the browser's time zone database does the work. `CalendarRange` (`booking`) turns a day and a view into the days shown and the `[from, to)` pibble is asked for. `ZonedDatePipe` displays both instants and `LocalDate`s in the zone.

## Alternatives considered

**`date-fns-tz` or Luxon.** Complete and tested, but a dependency for four operations, and Luxon's own `DateTime` type would spread through the domain and the templates.

**The `Temporal` API.** The right model (`PlainDate`, `ZonedDateTime`), but not in every browser Takodu's staff use, and its polyfill weighs more than the calendar.

**The device's time zone.** Simple, and right for a salon in Lima on a phone in Lima, but wrong for an owner abroad and for tests, which run in UTC to catch exactly this.

## Consequences

Tests run with `TZ=UTC` and check Lima days, a daylight-saving zone and month ends (`local-date.spec.ts`, `calendar-range.spec.ts`). A wall-clock time skipped by a daylight-saving jump resolves to the instant after it; Peru has none. When `Temporal` is available everywhere, `LocalDate` can wrap `Temporal.PlainDate` without changing its callers.
