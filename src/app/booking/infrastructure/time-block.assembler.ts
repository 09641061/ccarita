import type {
  CreateTimeBlockRequest,
  TimeBlock as TimeBlockResource,
} from '../../shared/infrastructure/api/pibble.schema';
import { required } from '../../shared/infrastructure/api/required';
import { CreateTimeBlock, TimeBlock } from '../domain/model/time-block';

export function toTimeBlock(resource: TimeBlockResource): TimeBlock {
  return new TimeBlock(
    required(resource.id, 'TimeBlock.id'),
    required(resource.establishmentId, 'TimeBlock.establishmentId'),
    resource.staffMemberId ?? null,
    new Date(required(resource.start, 'TimeBlock.start')),
    new Date(required(resource.end, 'TimeBlock.end')),
    resource.reason || null,
  );
}

export function toCreateTimeBlockRequest(command: CreateTimeBlock): CreateTimeBlockRequest {
  const reason = command.reason?.trim();
  return {
    ...(command.staffMemberId ? { staffMemberId: command.staffMemberId } : {}),
    start: command.start.toISOString(),
    end: command.end.toISOString(),
    ...(reason ? { reason } : {}),
  };
}
