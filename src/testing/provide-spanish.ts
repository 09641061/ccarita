import { EnvironmentProviders, Provider, inject, provideAppInitializer } from '@angular/core';
import { TranslateService, provideTranslateService } from '@ngx-translate/core';
import es from '../../public/i18n/es.json';

/** Test providers that render the real Spanish texts of `public/i18n/es.json`. */
export function provideSpanish(): (Provider | EnvironmentProviders)[] {
  return [
    provideTranslateService({ lang: 'es', fallbackLang: 'es' }),
    provideAppInitializer(() => {
      inject(TranslateService).setTranslation('es', es);
    }),
  ];
}
