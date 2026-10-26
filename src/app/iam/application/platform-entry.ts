import { InjectionToken, Signal, signal } from '@angular/core';

/**
 * Whether to offer the Takodu team's area (`/platform`) to the signed-in user. `platform` owns the operator check
 * and imports `iam`, so the app provides this from it; without that, the link is never shown. Only a convenience:
 * the area's guard and pibble decide.
 */
export interface PlatformEntry {
  readonly visible: Signal<boolean>;
}

export const PLATFORM_ENTRY = new InjectionToken<PlatformEntry>('PlatformEntry', {
  factory: () => ({ visible: signal(false) }),
});
