import { bootstrapApplication } from '@angular/platform-browser';
import { App } from './app/app';
import { appConfig } from './app/app.config';
import { loadRuntimeConfig } from './app/shared/infrastructure/config/runtime-config';
import { environment } from './environments/environment';

loadRuntimeConfig(environment)
  .then((config) => bootstrapApplication(App, appConfig(config)))
  // eslint-disable-next-line no-console -- the app failed to start, so nothing else can report it
  .catch((err: unknown) => console.error(err));
