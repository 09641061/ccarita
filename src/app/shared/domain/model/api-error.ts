/**
 * A failed call to pibble. `code` is pibble's error code (`SLOT_UNAVAILABLE`, `PLAN_INACTIVE`), or `NETWORK_ERROR`
 * when no answer arrived and `UNEXPECTED_ERROR` when the answer had no code. Screens show the message for the code,
 * never `message`, which is written for developers.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** Any thrown value as an ApiError, for code that catches without knowing what failed. */
  static of(error: unknown): ApiError {
    return error instanceof ApiError ? error : new ApiError(0, 'UNEXPECTED_ERROR', String(error));
  }

  /** The request may succeed if sent again with the same idempotency key. */
  get retryable(): boolean {
    return this.status === 0 || this.status >= 500;
  }
}
