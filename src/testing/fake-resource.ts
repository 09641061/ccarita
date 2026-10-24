import { signal } from '@angular/core';

/** A stand-in for an `rxResource` in view tests: set its value, error or loading, and spy on `reload`. */
export function fakeResource<T>(initial: T | undefined) {
  const value = signal<T | undefined>(initial);
  const error = signal<unknown>(undefined);
  const isLoading = signal(false);
  return {
    value,
    error,
    isLoading,
    hasValue: () => value() !== undefined && error() === undefined,
    reload: vi.fn(),
    set: (next: T) => value.set(next),
  };
}
