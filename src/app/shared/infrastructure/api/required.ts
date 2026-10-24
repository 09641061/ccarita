/**
 * A field pibble always sends but its OpenAPI document leaves optional. Assemblers call it so a missing field fails
 * at the boundary, naming the field, instead of showing up later as `undefined` on screen.
 */
export function required<T>(value: T | null | undefined, field: string): T {
  if (value === undefined || value === null) throw new Error(`pibble sent no ${field}`);
  return value;
}
