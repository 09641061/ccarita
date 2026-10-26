import { InjectionToken, Signal, signal } from '@angular/core';

/**
 * What the account screen shows of the organization the user works in. `iam` imports no other context, so the
 * app's routes provide it; without them times show in Lima and switching is not offered.
 */
export interface AccountWorkspace {
  /** O7: the selected establishment's IANA time zone, for the devices' times; `null` while unknown. */
  readonly timeZone: Signal<string | null>;
  /** The user belongs to several organizations. */
  readonly canSwitchOrganization: Signal<boolean>;
}

export const ACCOUNT_WORKSPACE = new InjectionToken<AccountWorkspace>('AccountWorkspace', {
  factory: () => ({ timeZone: signal(null), canSwitchOrganization: signal(false) }),
});
