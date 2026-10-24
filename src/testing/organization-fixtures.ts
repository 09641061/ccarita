/** pibble-shaped resources for organization tests. */
export const PLAN_ACTIVE_UNTIL = '2026-11-06T05:00:00Z';

export function joinedResource(
  id: string,
  role: 'owner' | 'manager' | 'staff' = 'owner',
  planActiveUntil = PLAN_ACTIVE_UNTIL,
) {
  return { id, name: `Negocio ${id}`, planActiveUntil, memberId: `m-${id}`, role };
}

export function establishmentResource(id: string, archivedAt?: string) {
  return {
    id,
    name: `Local ${id}`,
    address: 'Av. Larco 345',
    timeZone: 'America/Lima',
    ...(archivedAt ? { archivedAt } : {}),
  };
}
