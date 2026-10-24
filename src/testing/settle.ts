/** Lets pending promises and timers of zero delay run, so async interceptors and guards finish. */
export function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve));
}
