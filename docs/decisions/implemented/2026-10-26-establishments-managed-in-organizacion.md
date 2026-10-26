# Decision: Opening and archiving establishments in Organización

Status: implemented

## Problem

Opening another establishment (O4) and archiving one are owner actions (03 §5). Until Organización existed they sat in Ajustes › Datos, which edits the selected establishment's name, address and time zone. Mapa por rol puts them under Organización ("crear y archivar locales") next to the plan whose limit they count against. Two places offering the same actions drift apart and split the plan limit's explanation.

## Decision

Organización (`/organizacion`, `OrganizationPage`) lists the open establishments with "Abrir otro local" and an archive button per establishment, reusing `OpenEstablishmentSheet` and `ArchiveEstablishmentDialog`. Ajustes › Datos keeps only the selected establishment's details and links to Organización. Each establishment in the list has an edit button that selects it and opens Ajustes › Datos, so its details have one home.

## Alternatives considered

**Keep them in Ajustes › Datos and link from Organización.** Archiving there acts only on the selected establishment, so archiving another means switching first; the plan and its limit stay on another page.

**Offer them in both places.** Two entry points to keep alike for one owner action.

## Consequences

The owner sees every establishment, the plan and its limit on one page; archiving any establishment needs no switch. Ajustes › Datos is about one establishment only. An inactive plan disables opening and renaming but not archiving (O6) on the same page.

Superseded by [the settings center and trimmed navigation](2026-10-26-settings-center-and-trimmed-navigation.md): Locales lists, opens, edits and archives establishments, the business name is in Cuenta and the plan in Facturación.
