import { registerLocaleData } from '@angular/common';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import localeEsPe from '@angular/common/locales/es-PE';
import { MediaMatcher } from '@angular/cdk/layout';
import {
  ApplicationConfig,
  LOCALE_ID,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { MAT_RIPPLE_GLOBAL_OPTIONS, RippleGlobalOptions } from '@angular/material/core';
import { MatIconRegistry } from '@angular/material/icon';
import { provideRouter, withComponentInputBinding, withViewTransitions } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';
import { environment } from '../environments/environment';
import { routes } from './app.routes';
import { META_SIGNUP } from './conversations/public-api';
import { PLATFORM_ENTRY, authInterceptor } from './iam/public-api';
import { OperatorStore } from './platform/public-api';
import { API_BASE_URL } from './shared/infrastructure/http/api-base-url';
import { apiErrorInterceptor } from './shared/infrastructure/http/api-error.interceptor';
import { idempotencyInterceptor } from './shared/infrastructure/http/idempotency';
import { tenantInterceptor } from './shared/infrastructure/tenancy/tenant.interceptor';

registerLocaleData(localeEsPe);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideAppInitializer(() => {
      inject(MatIconRegistry).setDefaultFontSetClass('material-symbols-outlined');
    }),
    provideRouter(routes, withComponentInputBinding(), withViewTransitions()),
    provideHttpClient(
      withFetch(),
      withInterceptors([
        authInterceptor,
        tenantInterceptor,
        idempotencyInterceptor,
        apiErrorInterceptor,
      ]),
    ),
    provideTranslateService({
      loader: provideTranslateHttpLoader({ prefix: '/i18n/', suffix: '.json' }),
      fallbackLang: 'es',
      lang: 'es',
    }),
    { provide: LOCALE_ID, useValue: 'es-PE' },
    { provide: API_BASE_URL, useValue: environment.apiBaseUrl },
    { provide: META_SIGNUP, useValue: environment.metaSignup },
    // Cuenta and the organization picker offer /platform to operators; iam and organization cannot import platform.
    { provide: PLATFORM_ENTRY, useFactory: () => ({ visible: inject(OperatorStore).isOperator }) },
    {
      provide: MAT_RIPPLE_GLOBAL_OPTIONS,
      useFactory: (): RippleGlobalOptions => ({
        disabled: inject(MediaMatcher).matchMedia('(prefers-reduced-motion: reduce)').matches,
      }),
    },
  ],
};
