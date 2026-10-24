import { HttpErrorResponse } from '@angular/common/http';
import { toApiError } from './api-error.interceptor';

describe('toApiError', () => {
  it('keeps pibble’s code and status', () => {
    const error = toApiError(
      new HttpErrorResponse({ status: 409, error: { code: 'SLOT_UNAVAILABLE', message: 'taken' } }),
    );

    expect(error).toMatchObject({
      status: 409,
      code: 'SLOT_UNAVAILABLE',
      message: 'taken',
      retryable: false,
    });
  });

  it('names a missing answer a network error that can be retried', () => {
    const error = toApiError(new HttpErrorResponse({ status: 0 }));

    expect(error).toMatchObject({ code: 'NETWORK_ERROR', retryable: true });
  });

  it('names an answer without code an unexpected error', () => {
    expect(toApiError(new HttpErrorResponse({ status: 502, error: '<html>' })).code).toBe(
      'UNEXPECTED_ERROR',
    );
  });
});
