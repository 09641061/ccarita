import { registerLocaleData } from '@angular/common';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import localeEsPe from '@angular/common/locales/es-PE';
import { ApplicationConfig, LOCALE_ID, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';
import { environment } from '../environments/environment';
import { routes } from './app.routes';
import { API_BASE_URL } from './shared/infrastructure/http/api-base-url';
import { apiErrorInterceptor } from './shared/infrastructure/http/api-error.interceptor';
import { idempotencyInterceptor } from './shared/infrastructure/http/idempotency';
import { tenantInterceptor } from './shared/infrastructure/tenancy/tenant.interceptor';

registerLocaleData(localeEsPe);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(
      withFetch(),
      withInterceptors([tenantInterceptor, idempotencyInterceptor, apiErrorInterceptor]),
    ),
    provideTranslateService({
      loader: provideTranslateHttpLoader({ prefix: '/i18n/', suffix: '.json' }),
      fallbackLang: 'es',
      lang: 'es',
    }),
    { provide: LOCALE_ID, useValue: 'es-PE' },
    { provide: API_BASE_URL, useValue: environment.apiBaseUrl },
  ],
};
