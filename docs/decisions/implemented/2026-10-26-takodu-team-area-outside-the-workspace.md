# Decision: The Takodu team area outside the workspace, with plan dates in Lima

Status: implemented

## Problem

The Takodu team sets plans after a payment and reads assistant usage through pibble's internal API (`/internal/v1/**`, O5, A9), signed in as a user pibble marks as platform operator. An operator works across every organization and may belong to none, so the workspace, which needs a selected organization and shows one establishment and its time zone, does not fit them. The screens also need a time zone for plan ends, which are instants, while no establishment is selected. Other contexts must offer the area to operators without importing `platform`, which only `iam` sits below.

## Decision

`/platform` is its own route branch in `app.routes.ts`, outside `Workspace`, behind `authGuard` and `operatorGuard`. The guard asks `GET /internal/v1/operator` on every entry once a session exists: a 403 goes to `/sin-permiso`, a 401 to sign-in, and an unreachable pibble opens the area so its screens offer to retry. `PlatformFrame` has no establishment, role navigation or plan, only a link to the operator's own businesses (`/organizaciones`) and sign-out.

Cuenta (`iam`) and the organization picker (`organization`) show "Panel de Takodu" through `PLATFORM_ENTRY`, a token declared in `iam` and provided in `app.config.ts` from `OperatorStore.isOperator`, which asks pibble once per signed-in user. The picker matters because an operator with no business lands there after sign-in.

Plan ends and history times show and are typed in America/Lima (`OPERATOR_TIME_ZONE`), labelled "hora de Lima"; a typed end day ends at 23:59 Lima. Usage days stay in each establishment's own zone, as pibble reports them.

## Alternatives considered

**Inside `Workspace` behind a role.** The workspace requires an organization and its role; operators may have neither, and the platform role is not a member role.

**An entry in the shell's navigation.** `Shell` is in `shared` and its items come from member roles; the operator flag would have to reach the kernel.

**Show plan dates in the device's zone.** Tests run in UTC to catch this, and two operators would see different days for one payment.

**Show plan dates in the organization's first establishment's zone.** pibble's internal list carries no time zone, and an organization's establishments may sit in different zones.

## Consequences

An operator without a business can sign in and work. Every non-operator who opens Cuenta or the picker makes one extra `GET /internal/v1/operator`, answered 403. Plan dates read the same for every operator; an organization outside Peru sees its end in Lima time in the area, labelled as such.
