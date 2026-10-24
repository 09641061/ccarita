---
name: ccarita-ui
description: How ccarita builds screens with Angular 22 and Angular Material 3 — standalone OnPush components with signals, input() and output(), built-in control flow, Signal Forms, Material components and the mat.theme system tokens, phone-first layouts, the loading, empty, error, no-permission and plan-inactive states, accessibility, Spanish texts in es.json, and dates and money in the establishment's time zone. Use for any component, template, form, style or text change.
---

# Screens in ccarita

Visual design comes from the designs made for Takodu; this skill fixes how they are built. When a design and a product rule disagree, the rule wins and you tell the user.

## Components

- Standalone, `changeDetection: ChangeDetectionStrategy.OnPush` (lint enforces it), `inject()` instead of constructor parameters.
- Inputs and outputs with `input()`, `input.required()`, `output()` and `model()`; derived values with `computed()`; never `@Input`, `@Output` or manual subscriptions in components.
- Templates use `@if`, `@for (…; track item.id)` with `@empty`, `@switch`, `@let`. No `*ngIf` or `*ngFor`.
- Views read stores; components receive data. A component that needs a store is a view or belongs in one.
- Template and style files sit next to the class; inline templates only for a few lines.

## Forms

- Signal Forms from `@angular/forms/signals`: a `signal` model, `form(model, (path) => { required(path.email); maxLength(path.reason, 500) })`, and `[formField]="f.email"` on the Material input.
- Mirror pibble's limits from `api/openapi.json` (`maxLength`, `pattern`) so users see problems before submitting; pibble still validates.
- Submit disables the button and shows progress while pending; the idempotency key is created when the form opens ([ccarita-api](../ccarita-api/SKILL.md)). A failed submit keeps the input and shows the message next to the action, with retry when `error.retryable`.

## Material 3

- Use Angular Material and CDK components before writing custom ones: toolbar, sidenav, list, card, button (`matButton="filled" | "outlined" | "tonal" | "text"`, `matIconButton`), form field, select, datepicker, timepicker, dialog, bottom sheet, snack bar, chips, tabs, progress bar.
- Colors, type and shape come from the theme: `@include mat.theme(...)` in `src/styles.scss` and `var(--mat-sys-*)` tokens in component styles. No hard-coded colors, fonts or shadows; customize components with `mat.<component>-overrides(...)`.
- Icons are Material Symbols (`<mat-icon>`), loaded in `index.html`.
- Phone first: design for 360 px wide, then add a breakpoint with `BreakpointObserver` or CSS for tablet and desktop. Dialogs become bottom sheets or full screens on phones.

## Motion

- Material components already animate (ripples, dialogs, menus, sheets, tabs); do not add motion on top of them.
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
- Dates and times: `DatePipe` with the establishment's `timeZone` (`{{ a.start | date: 'EEE d MMM, HH:mm' : tz }}`), never the device's. The app locale is `es-PE`.
- Money: `money.format()` (`S/ 35.00`).
- Phone numbers are shown as stored (E.164); never log them, message bodies or tokens to the console.

## Accessibility

Template lint includes the accessibility rules. Every control has a visible label or `aria-label`, icon buttons have `aria-label`, errors use `role="alert"`, dialogs move focus to their title, and interactive targets are at least 48 px. Do not convey state by color alone: add a text or icon (appointment status, message delivery).

## Tests

`TestBed` with the store replaced by an object of signals; assert each state in the DOM, that the right store method is called with the idempotency key, and the Spanish text for an error code. Prefer `fixture.whenStable()` over manual `detectChanges()` loops.

## Checklist

- [ ] OnPush, signals, `input()`/`output()`, built-in control flow.
- [ ] Material components and `--mat-sys-*` tokens; no hard-coded styles.
- [ ] Loading, empty, error, no-permission, plan-inactive and offline states.
- [ ] Texts in `es.json`; times in the establishment's zone; accessible controls.
