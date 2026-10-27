import { InjectionToken } from '@angular/core';

/** Where an owner writes to renew the plan (O5), from the deployment's `RuntimeConfig.renewalContact`. */
export const RENEWAL_CONTACT = new InjectionToken<string>('RenewalContact', {
  factory: () => '',
});
