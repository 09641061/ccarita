import { bootstrapApplication } from '@angular/platform-browser';
import { App } from './app/app';
import { appConfig } from './app/app.config';

// eslint-disable-next-line no-console -- the app failed to start, so nothing else can report it
bootstrapApplication(App, appConfig).catch((err: unknown) => console.error(err));
