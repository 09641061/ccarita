import { InjectionToken, Signal, signal } from '@angular/core';

/**
 * The navigation paths that need someone's attention, which the shell marks with a dot (`/mensajes` while a
 * customer waits for a person). Contexts above `shared` own the reasons, so the app provides this from them; without
 * that, nothing is marked.
 */
export const NAVIGATION_ATTENTION = new InjectionToken<Signal<ReadonlySet<string>>>(
  'NavigationAttention',
  { factory: () => signal(new Set<string>()) },
);
