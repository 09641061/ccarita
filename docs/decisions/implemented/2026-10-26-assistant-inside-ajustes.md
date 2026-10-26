# Decision: The assistant's screens inside Ajustes

Status: implemented

## Problem

The designs put the assistant in two places: "Asistente" is a destination of the main navigation (in the phone's bottom bar), and its screen (`ui-reference/Ajustes · Asistente`) is drawn inside Ajustes, with the tabs Datos, Horario, Servicios, WhatsApp, Asistente and Uso and the establishment in the header. The settings and the usage are per establishment (A1, A9), like the other tabs. A screen reachable at two URLs drifts: two routes to guard, two frames to keep alike, and two answers to "where am I".

## Decision

The screens live once, at `/ajustes/asistente` (`AssistantConfiguration`) and `/ajustes/uso` (`UsageReport`), two tabs of `Settings` for the roles with `editSettings` (owners and managers, 03 §5). They belong to the `assistant` context, which `organization` does not import, so `app.routes.ts` passes them to `settingsRoutes` with the line's screen, as `SettingsScreens`. `/asistente` is a redirect to `/ajustes/asistente`, without a guard of its own (Angular refuses a guard beside a redirect; the target is guarded). The navigation item stays: its `also` paths are `/ajustes/asistente` and `/ajustes/uso`, and `Shell` marks the item whose path or `also` path is the longest prefix of the URL (`activeItem`), so those tabs light "Asistente", not "Ajustes".

## Alternatives considered

**A standalone `/asistente` screen without the tabs.** Matches the navigation, but loses the establishment header and the tabs the design draws, and Ajustes would have no way to it.

**Mounting `Settings` a second time under `/asistente`.** The tabs link relatively, so they would lead to `/asistente/horario` and duplicate every section.

**Dropping the navigation item.** The assistant is the product's distinguishing feature and the bar's fourth destination in the design.

## Consequences

One route per screen, guarded once by `/ajustes`' role guard. The phone's bar keeps "Asistente" active on both tabs. Staff, who have no Ajustes, reach neither URL (`/sin-permiso`).

Superseded by [the settings center and trimmed navigation](2026-10-26-settings-center-and-trimmed-navigation.md): the assistant has no navigation entry, and its settings and usage are sections of the center.
