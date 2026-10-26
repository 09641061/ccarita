import { InjectionToken, Type } from '@angular/core';

/** Loads a screen lazily, as a route's `loadComponent` does. */
export type ScreenLoader = () => Promise<Type<unknown>>;

/**
 * The screens of other contexts that the settings center and Primeros pasos show, which `organization` does not
 * import: the line's screen of `conversations`, and the assistant's settings and usage of `assistant`. The app
 * provides them.
 */
export interface SettingsScreens {
  readonly whatsapp: ScreenLoader;
  readonly assistant: ScreenLoader;
  readonly usage: ScreenLoader;
}

export const SETTINGS_SCREENS = new InjectionToken<SettingsScreens>('SettingsScreens');
