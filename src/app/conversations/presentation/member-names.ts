import { Member } from '../../organization/public-api';

/** Names by member id, for assignees, pauses and the staff who signed a message. */
export function memberNames(members: ReadonlyMap<string, Member>): ReadonlyMap<string, string> {
  return new Map([...members].map(([id, member]) => [id, member.name]));
}
