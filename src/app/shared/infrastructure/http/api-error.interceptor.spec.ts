import {
  HttpClient,
  HttpErrorResponse,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { apiErrorInterceptor, toApiError } from './api-error.interceptor';

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

describe('apiErrorInterceptor', () => {
  it('reads the code of a download’s error, which arrives as a blob', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiErrorInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    const result = firstValueFrom(
      TestBed.inject(HttpClient).get('/media/m-1', { responseType: 'blob' }),
    ).catch((error: unknown) => error);
    TestBed.inject(HttpTestingController)
      .expectOne('/media/m-1')
      .flush(new Blob([JSON.stringify({ code: 'MEDIA_NOT_READY', message: 'x' })]), {
        status: 409,
        statusText: 'Conflict',
      });

    expect(await result).toMatchObject({ status: 409, code: 'MEDIA_NOT_READY' });
  });
});
