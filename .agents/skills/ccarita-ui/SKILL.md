---
name: ccarita-ui
description: How ccarita builds screens with Angular 22 and Angular Material 3 — standalone OnPush components with signals, input() and output(), built-in control flow, Signal Forms, Material components and the mat.theme system tokens, phone-first layouts, the loading, empty, error, no-permission and plan-inactive states, accessibility, Spanish texts in es.json, and dates and money in the establishment's time zone. Use for any component, template, form, style or text change.
---

# Screens in ccarita

Visual design comes from the designs made for Takodu; this skill fixes how they are built. When a design and a product rule disagree, the rule wins and you tell the user.

## Design reference

- The designs are in `../ui-reference` (Claude Design exports, outside the repository). Each screen has a base file and an `M3` wrapper: take layout and shape from the M3 version, colors and type from the base `Sistema.dc.html`, never the M3 sheet's generated colors.
- **pibble's current API wins over the designs.** Build only what `api/openapi.json` serves; an element without backend data is adapted or dropped, never faked, and pibble is not changed for it. The README's roadmap lists the adaptations.
- Material gives the shape; Takodu gives the colors. The M3 role → token table lives in `$roles` in `src/styles.scss` and `THEME_ROLES`, checked by `pnpm theme:check` and shown at `/dev/ui` ([decision](../../../docs/decisions/implemented/2026-10-23-takodu-tokens-on-m3-roles.md)). Tokens without a role are `--tk-*`: appointment states, warnings, member colors, chat background, assistant gradient, motion.
- `BrandMark` marks only the assistant (its settings, message signature, the appointments it booked) and is never recolored. Its settings say "Asistente"; its messages sign as "Tako".
- Compare every new screen with its design at 390 × 844 and 1440 × 900, light and dark: `pnpm start`, then `pnpm screenshots`.

## Components

- Standalone, `changeDetection: ChangeDetectionStrategy.OnPush` (lint enforces it), `inject()` instead of constructor parameters.
- Inputs and outputs with `input()`, `input.required()`, `output()` and `model()`; derived values with `computed()`; never `@Input`, `@Output` or manual subscriptions in components.
- Templates use `@if`, `@for (…; track item.id)` with `@empty`, `@switch`, `@let`. No `*ngIf` or `*ngFor`.
- Views read stores; components receive data. A component that needs a store is a view or belongs in one.
- Template and style files sit next to the class; inline templates only when short.

## Forms

- Signal Forms from `@angular/forms/signals`: a `signal` model, `form(model, (path) => { required(path.email); maxLength(path.reason, 500) })`, and `[formField]="f.email"` on the Material input.
- Mirror pibble's limits from `api/openapi.json` (`maxLength`, `pattern`) so users see problems before submitting; pibble still validates.
- Submit disables the button and shows progress while pending; the idempotency key is created when the form opens ([ccarita-api](../ccarita-api/SKILL.md)). A failed submit keeps the input and shows the message next to the action, with retry when `error.retryable`.

## Material 3

- Use Angular Material and CDK components before writing custom ones: toolbar, sidenav, list, card, button (`matButton="filled" | "outlined" | "tonal" | "text"`, `matIconButton`), form field, select, datepicker, timepicker, dialog, bottom sheet, snack bar, chips, tabs, progress bar.
- Colors, type and shape come from the theme in `src/styles.scss`: `var(--mat-sys-*)` and `var(--tk-*)` in component styles. No hard-coded colors, fonts or shadows; customize components with `mat.<component>-overrides(...)`.
- Reuse the shared components before writing one: `StatusBadge`, `Avatar`, `StateView`, `Skeleton`, `BusyButton`, `PlanBanner`, `MessageOrigin`, `DeliveryStatus`, `BrandMark`.
- Icons are Material Symbols (`<mat-icon>`), loaded in `index.html` ([decision](../../../docs/decisions/implemented/2026-10-23-material-symbols-for-icons.md)).
- Phone first: design for 360 px wide, then add a breakpoint with `BreakpointObserver` or CSS for tablet and desktop. Dialogs become bottom sheets or full screens on phones.
- A footer stuck to the bottom uses `bottom: var(--shell-bottom-inset, 0px)`, above the navigation bar.

## Motion

- Material components already animate; add no motion on top of them.
- Custom motion is CSS transitions, or `animate.enter="tk-enter"` / `animate.leave="tk-leave"` in templates. Never `@angular/animations`; it is legacy.
- Durations and easing come only from `--tk-duration-short` (160 ms: hover, press), `--tk-duration-medium` (300 ms: panels, sheets), `--tk-motion-standard` and `--tk-motion-emphasized` (things entering).
- Page changes use the router's view transitions. `prefers-reduced-motion: reduce` turns animations, transitions and ripples off; never override it.

## States every screen renders

| State         | From                                                                                                               |
| ------------- | ------------------------------------------------------------------------------------------------------------------ |
| Loading       | `resource.isLoading()`; a progress bar, keeping the old data visible on reload                                     |
| Empty         | `@empty`, with the next useful action                                                                              |
| Error         | `resource.error()` or the command's `ApiError` through `errorMessage`, with retry                                  |
| No permission | `ACCESS_DENIED` or a role that lacks the action                                                                    |
| Plan inactive | `CurrentOrganization.planActive()` false: banner, writes disabled ([ccarita-session](../ccarita-session/SKILL.md)) |
| Offline       | `NETWORK_ERROR`: keep what was shown, offer retry                                                                  |

## Texts, dates and money

- Every visible text goes through `| translate` with a key in `public/i18n/es.json`, grouped by context and screen (`booking.calendar.title`). Spanish (Peru), short, using "tú".
- Dates and times: the shared `zonedDate` pipe with the establishment's IANA `timeZone` (`{{ a.start | zonedDate: tz : 'dayTime' }}`), never the device's; it also names a `LocalDate`. A typed day and time become an instant with `LocalDate.parse(day).atTime(time, tz)`. `DatePipe` ignores IANA names, and tests run in UTC to catch it. The app locale is `es-PE`.
- Money: `money.format()` (`S/ 35.00`).
- Phone numbers show as stored (E.164); never log them, message bodies or tokens.

## Accessibility

Template lint includes the accessibility rules. Every control has a visible label or `aria-label`, icon buttons have `aria-label`, errors use `role="alert"`, dialogs move focus to their title, and interactive targets are at least 48 px. Do not convey state by color alone: add a text or icon (appointment status, message delivery).

## Tests

`TestBed` with the store replaced by an object of signals; assert each state in the DOM, that the right store method is called with the idempotency key, and the Spanish text for an error code. Prefer `fixture.whenStable()` over manual `detectChanges()` loops.

## Checklist

- [ ] OnPush, signals, `input()`/`output()`, built-in control flow.
- [ ] Material components and `--mat-sys-*` tokens; no hard-coded styles.
- [ ] Loading, empty, error, no-permission, plan-inactive and offline states.
- [ ] Texts in `es.json`; times in the establishment's zone; accessible controls.
