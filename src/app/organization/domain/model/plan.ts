/** O5: the plan is active while its end is in the future. */
export function planActiveAt(activeUntil: Date, now: Date): boolean {
  return now.getTime() < activeUntil.getTime();
}
