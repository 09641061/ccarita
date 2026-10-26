import { InjectionToken, Signal, signal } from '@angular/core';

/**
 * Whether the selected establishment's WhatsApp line is connected, for Primeros pasos. The line belongs to
 * `conversations`, which `organization` does not import, so the app's routes provide it; `null` while unknown.
 */
export interface EstablishmentLine {
  readonly connected: Signal<boolean | null>;
}

export const ESTABLISHMENT_LINE = new InjectionToken<EstablishmentLine>('EstablishmentLine', {
  factory: () => ({ connected: signal(null) }),
});

/**
 * Whether the selected establishment's assistant is on, for Primeros pasos. The settings belong to `assistant`,
 * which `organization` does not import, so the app's routes provide it; `null` while unknown.
 */
export interface EstablishmentAssistant {
  readonly enabled: Signal<boolean | null>;
}

export const ESTABLISHMENT_ASSISTANT = new InjectionToken<EstablishmentAssistant>(
  'EstablishmentAssistant',
  { factory: () => ({ enabled: signal(null) }) },
);
