# Decision: Material Symbols for icons

Status: implemented

## Problem

The designs draw Lucide line icons at a 1.6 stroke, 16 px on desktop and 22 px on phones. Angular Material renders icons through `<mat-icon>`, which expects a font or registered SVGs, and Material's own components (form fields, chips, selects, steppers) already show Material Symbols.

## Decision

Icons are Material Symbols Outlined, a variable font loaded in `index.html`, rendered with `<mat-icon>` by ligature name. `app.config.ts` sets `material-symbols-outlined` as the default font set, and `styles.scss` uses the light weight (300) and no fill, which comes close to the designs' thin lines; an active navigation item may switch to the filled axis, as M3 does. Components size icons in their own styles (16 px inside badges and message rows). The Takodu mark is not an icon: it is `public/brand/takodu.svg`, shown only by `BrandMark` for the assistant.

## Alternatives considered

**Lucide as SVGs registered in `MatIconRegistry`.** Matches the designs exactly, but every icon must be added by hand to the registry, and Material components would still mix in Material Symbols, giving two icon styles on one screen.

**Lucide's Angular package without `<mat-icon>`.** Same mix of styles, plus a second icon API next to Material's.

## Consequences

One icon family everywhere and no icon assets to maintain. Some glyphs differ from the designs (the status badges use `check`, `play_arrow`, `check_circle`, `close` and `person_off`), and the font is a network request the first time.
