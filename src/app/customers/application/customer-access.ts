import { InjectionToken, Signal, signal } from '@angular/core';

/**
 * What the signed-in member may do on the Clientes page. `customers` imports no other context, like in pibble,
 * so the app's routes provide it from the organization's role and plan; without them nothing extra is offered.
 */
export interface CustomerAccess {
  /** C3: owners and managers delete customers. */
  readonly canDelete: Signal<boolean>;
  /** O6: booking for a customer waits for an active plan. */
  readonly canBook: Signal<boolean>;
}

export const CUSTOMER_ACCESS = new InjectionToken<CustomerAccess>('CustomerAccess', {
  factory: () => ({ canDelete: signal(false), canBook: signal(false) }),
});
