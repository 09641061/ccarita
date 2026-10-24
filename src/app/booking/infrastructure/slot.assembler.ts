import type { Slot as SlotResource } from '../../shared/infrastructure/api/pibble.schema';
import { required } from '../../shared/infrastructure/api/required';
import { Slot } from '../domain/model/slot';

export function toSlot(resource: SlotResource): Slot {
  return new Slot(
    new Date(required(resource.start, 'Slot.start')),
    new Date(required(resource.end, 'Slot.end')),
    resource.freeMemberIds ?? [],
  );
}
