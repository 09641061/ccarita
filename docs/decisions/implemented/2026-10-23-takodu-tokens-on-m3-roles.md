# Decision: Takodu tokens mapped onto Material 3 roles

Status: implemented

## Problem

Takodu's visual system defines its own tokens: the brand green `#33C19A` with its dark text `#04261C`, cool grey surfaces and borders, Geist type and tabular numbers. Angular Material 3 builds every color role from palettes. The Claude Design export also has an M3 version, generated from the seed `#33C19A`; it turned the brand green into `#006C51` and the surfaces into a green-grey, which reads as another brand. The app needs Material's components, shapes and states without losing Takodu's colors.

## Decision

Material provides the shape: pill buttons, the navigation drawer and bar, segmented buttons, 28 px dialogs, ripples and elevation. Takodu provides the colors and the type. `src/styles.scss` calls `mat.theme` with the green palette, `theme-type: color-scheme` and Geist, then `mat.theme-overrides` with a `$roles` map that sets 35 color roles to a Takodu token each: `primary` is `--accent`, `surface-container-low` is the page background `--bg`, `outline-variant` is `--border`, and so on. Each value is `light-dark(<light>, <dark>)`, so `color-scheme` picks the scheme: the system preference by default, or the `light` or `dark` class on `<html>`. Only the fixed roles, `shadow` and `scrim` keep Material's values. `#33C19A` is a fill color: as text on a light surface it falls below 3:1, so where Material writes text in `primary` (text, outlined and elevated button labels, a focused field's label) `mat.button-overrides` and `mat.form-field-overrides` use `on-primary-container`, the strong accent the base design uses for text.

Tokens without an M3 role (appointment states, warnings, member colors, the chat background, the assistant's gradient, the focus ring, motion) are `--tk-*` variables in the same file. Components use only `--mat-sys-*` and `--tk-*`.

`mat.theme-overrides` drops a role name it does not know without an error. `THEME_ROLES` in `src/app/shared/presentation/theme/theme-roles.ts` lists every role with its token, and `pnpm theme:check` (in `pnpm check` and CI) compiles the styles and fails if a role is missing or differs. The development style guide at `/dev/ui` shows the same table with live swatches.

## Alternatives considered

**A palette generated from `#33C19A`.** The least code and the M3 tonal system intact, but the brand green becomes `#006C51`, the containers mint and the surfaces green-grey, which the brand rejected.

**Custom palettes tuned until tone 40 equals `#33C19A`.** Keeps Material's tonal logic, but tone 40 is the dark text color in M3; forcing the brand green there breaks the contrast of every role derived from it, and the other tones are still guesses.

**Takodu's CSS without Material theming.** Full control of color, but every component (dialogs, menus, fields, chips) would need hand-written states and accessibility that Material already has.

## Consequences

The brand colors are exact in light and dark, and Material components pick them up through the system variables. The two lists, `$roles` and `THEME_ROLES`, must be edited together; the check fails when they drift. Roles Material derives from the palette (fixed colors) still exist but no screen uses them.
