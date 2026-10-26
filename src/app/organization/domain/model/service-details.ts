/** O14, O15: the whole editable state of a service, as pibble replaces it; prices are in PEN. */
export interface ServiceDetails {
  readonly name: string;
  readonly durationMinutes: number;
  readonly priceCents: number;
  readonly instructions: string;
  readonly performerIds: readonly string[];
}

/** pibble's limit on `priceCents`. */
export const MAX_PRICE_CENTS = 100_000_000;

const SOLES = /^\d{1,7}(?:[.,]\d{1,2})?$/;

/**
 * O14: a price typed in soles (`35`, `35.5`, `35,50`) as whole céntimos (≥ 0); `null` when it is not a price.
 * Parsed from the digits, never through floating point.
 */
export function priceCentsOf(text: string): number | null {
  const typed = text.trim().replace(/^S\/\s*/i, '');
  if (!SOLES.test(typed)) return null;
  const [soles, fraction = ''] = typed.split(/[.,]/);
  const cents = Number(soles) * 100 + Number(fraction.padEnd(2, '0'));
  return cents <= MAX_PRICE_CENTS ? cents : null;
}

/** Céntimos as the soles a form shows (`3500` → `35.00`). */
export function priceTextOf(cents: number): string {
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`;
}
