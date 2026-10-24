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

export function memberResource(
  id: string,
  overrides: Partial<{
    displayName: string;
    role: 'owner' | 'manager' | 'staff';
    bookable: boolean;
    status: 'pending' | 'active';
    establishmentIds: string[];
  }> = {},
) {
  return {
    id,
    email: `${id}@example.com`,
    displayName: `Persona ${id}`,
    role: 'staff',
    bookable: true,
    status: 'active',
    establishmentIds: ['est-1'],
    ...overrides,
  };
}

export function serviceResource(id: string, durationMinutes = 45, priceCents = 3500) {
  return {
    id,
    establishmentId: 'est-1',
    name: `Servicio ${id}`,
    durationMinutes,
    priceCents,
    currency: 'PEN',
    active: true,
    performerIds: [],
  };
}
