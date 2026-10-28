import { Appointment, AppointmentStatus } from '../app/booking/domain/model/appointment';
import { TimeBlock } from '../app/booking/domain/model/time-block';
import { Money } from '../app/shared/domain/model/money';

/** pibble-shaped resources and domain objects for booking tests, on Friday 23 Oct 2026 in Lima (UTC-5). */
export function appointmentResource(
  id: string,
  overrides: Partial<Record<string, unknown>> = {},
): Record<string, unknown> {
  return {
    id,
    establishmentId: 'est-1',
    customerId: 'c-1',
    serviceId: 's-1',
    staffMemberId: 'm-1',
    start: '2026-10-23T17:00:00Z',
    end: '2026-10-23T17:45:00Z',
    priceCents: 3500,
    currency: 'PEN',
    status: 'confirmed',
    source: 'staff',
    ...overrides,
  };
}

export function timeBlockResource(
  id: string,
  overrides: Partial<Record<string, unknown>> = {},
): Record<string, unknown> {
  return {
    id,
    establishmentId: 'est-1',
    staffMemberId: 'm-1',
    start: '2026-10-23T18:00:00Z',
    end: '2026-10-23T19:00:00Z',
    reason: 'Almuerzo',
    ...overrides,
  };
}

export function appointment(
  status: AppointmentStatus = 'confirmed',
  overrides: Partial<{
    id: string;
    start: string;
    end: string;
    staffMemberId: string;
    customerId: string;
    source: 'staff' | 'assistant';
    createdAt: string | null;
  }> = {},
): Appointment {
  const o = {
    id: 'a-1',
    start: '2026-10-23T17:00:00Z',
    end: '2026-10-23T17:45:00Z',
    staffMemberId: 'm-1',
    customerId: 'c-1',
    source: 'staff' as const,
    createdAt: null as string | null,
    ...overrides,
  };
  return new Appointment(
    o.id,
    'est-1',
    o.customerId,
    's-1',
    o.staffMemberId,
    new Date(o.start),
    new Date(o.end),
    new Money(3500, 'PEN'),
    status,
    o.source,
    null,
    null,
    o.createdAt ? new Date(o.createdAt) : null,
  );
}

export function timeBlock(
  staffMemberId: string | null = 'm-1',
  start = '2026-10-23T18:00:00Z',
  end = '2026-10-23T19:00:00Z',
  id = 'b-1',
): TimeBlock {
  return new TimeBlock(id, 'est-1', staffMemberId, new Date(start), new Date(end), 'Almuerzo');
}
