/** O7: the IANA zones offered for an establishment: the Americas, plus the one it already has. */
export function timeZoneOptions(current: string): readonly string[] {
  const zones = Intl.supportedValuesOf('timeZone').filter((zone) => zone.startsWith('America/'));
  return current && !zones.includes(current) ? [current, ...zones] : zones;
}

export const DEFAULT_TIME_ZONE = 'America/Lima';
