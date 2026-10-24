/**
 * A key for one user action, sent as pibble's `Idempotency-Key`. Views create it when the action starts and send
 * the same key when that action is retried, so a lost response never books, sends or invites twice.
 */
export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}
