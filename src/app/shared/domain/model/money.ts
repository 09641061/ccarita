/** An amount in integer cents with its ISO currency, as pibble stores prices (`priceCents`, `currency`). */
export class Money {
  constructor(
    readonly cents: number,
    readonly currency: string,
  ) {
    if (!Number.isInteger(cents)) throw new Error(`Money needs whole cents, got ${cents}`);
  }

  /** `S/ 35.00` (with a no-break space) for PEN in es-PE. */
  format(locale = 'es-PE'): string {
    return new Intl.NumberFormat(locale, { style: 'currency', currency: this.currency }).format(
      this.cents / 100,
    );
  }
}
