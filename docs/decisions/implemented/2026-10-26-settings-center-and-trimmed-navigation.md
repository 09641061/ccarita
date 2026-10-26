# Decision: A settings center over the screen, and a navigation of daily work

Status: implemented

## Problem

The navigation had eight destinations for an owner: Calendario, Mensajes, Clientes and Asistente for daily work, plus Equipo, Ajustes, Organización and Cuenta, which are visited rarely. On phones the last four sat behind a "Más" page, and a plan card filled the foot of the drawer. "Mapa por rol" in `ui-reference` draws that layout, and "Ajustes · Asistente" draws the assistant as a tab of a full Ajustes page. Every visit to a setting left the screen the user was working on, and the assistant had two entries ([earlier decision](2026-10-26-assistant-inside-ajustes.md)). The product owner asked for a Claude-like layout: few destinations, a profile button with a small menu, and settings in a window.

## Decision

The navigation, in the drawer and the phone's bottom bar, is Calendario, Mensajes, Clientes and Equipo (Equipo for owners and managers); "Más" is gone. Asistente leaves the navigation until it becomes a chat of its own.

The foot of the drawer is `ProfileMenu`: the user's name and, after a dot, the organization's plan ("Luis Ramírez · Plan Max"); on phones only the avatar, in the top bar. Its menu has Ajustes, Cambiar de organización and Panel de Takodu when they apply, Cerrar sesión, and "Ayuda", "Subir plan" and "Aprender más" as disabled placeholders marked "Pronto". The plan card is removed; `PlanBanner` still marks an inactive plan.

`SettingsCenter` (`organization`) is a `MatDialog` that `Workspace` opens over the current screen whenever the address has `?ajustes=<section>`: a list of sections grouped by what they tune, not by whose they are: General (Cuenta, Negocio), Atención (Datos del local, Horario, Servicios) and Mensajes (WhatsApp, Asistente, Uso), filtered by `canPerform`, and the chosen section beside it, its header naming the selected establishment when the section acts on it; on phones the list, then the section with a back arrow. Switching sections replaces the address, so back closes the center; a value the role cannot use opens the first section it can. Any context links to a section with the shared `SettingsLink` directive, which never imports `organization`. The screens of `conversations` and `assistant` arrive through `SETTINGS_SCREENS`, provided on the `Workspace` route with `ACCOUNT_WORKSPACE`. The routes `/ajustes/**`, `/organizacion`, `/cuenta`, `/asistente` and `/mas` are removed without redirects.

## Alternatives considered

**Keep the pages and only trim the navigation.** Each setting still leaves the current screen, and the profile menu would link to five pages.

**Groups by owner (Tu cuenta, Este local, Organización).** The first version; it read like the old pages under new headings, and the product owner asked for areas by purpose, as in Claude's settings.

**A dialog without an address.** Simpler, but back would leave the app instead of closing it, and other screens could not link to a section.

**An auxiliary route (`/agenda(ajustes:horario)`).** Angular's named outlets give the same behavior with harder links and guards; a query parameter works on every screen of the frame.

**Redirect the old routes to the center.** The user asked for no redirect chains; nothing outside the app links to them, since pibble only emails `/invitations/:token`.

## Consequences

Settings never cover the work underneath for longer than they are open, and the navigation shows only daily work. The departure from "Mapa por rol" and "Ajustes · Asistente" is deliberate; the assistant has no navigation entry until its chat exists. Opening and archiving establishments stay in Organización ([decision](2026-10-26-establishments-managed-in-organizacion.md)), now a section. A stale bookmark to a removed route shows "Página no encontrada".
