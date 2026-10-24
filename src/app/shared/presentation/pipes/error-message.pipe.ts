import { Pipe, PipeTransform, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { ApiError } from '../../domain/model/api-error';

/**
 * The Spanish message for a failure: `errors.<code>` in `public/i18n/es.json`, then the family of the code
 * (`CUSTOMER_NOT_FOUND` → `errors.NOT_FOUND`), then `errors.UNEXPECTED_ERROR`.
 */
@Pipe({ name: 'errorMessage' })
export class ErrorMessagePipe implements PipeTransform {
  private readonly translate = inject(TranslateService);

  transform(error: unknown): string {
    const { code } = ApiError.of(error);
    for (const key of [code, family(code), 'UNEXPECTED_ERROR']) {
      const message = this.translate.instant(`errors.${key}`);
      if (message !== `errors.${key}`) return message;
    }
    return code;
  }
}

function family(code: string): string {
  if (code.endsWith('_NOT_FOUND')) return 'NOT_FOUND';
  if (code.endsWith('_CONFLICT')) return 'CONFLICT';
  return code;
}
