import { appointment, timeBlock } from '../../../testing/booking-fixtures';
import { Member } from '../../organization/public-api';
import { LocalDate } from '../../shared/domain/model/local-date';
import { EntrySources, entriesOfDay } from './calendar-entries';

const LIMA = 'America/Lima';
const kevin = new Member('m-2', 'kevin@example.com', 'Kevin', 'staff', true, 'active', ['est-1']);

describe('entriesOfDay', () => {
  const sources: EntrySources = {
    members: new Map([[kevin.id, kevin]]),
    memberOrder: ['m-1', 'm-2'],
    services: new Map(),
    customers: new Map([['c-gone', 'deleted']]),
    conflicts: new Map([['a-2', timeBlock('m-2')]]),
    canManage: () => true,
  };

  it('keeps the day in the establishment zone, earliest first, blocks before appointments at the same time', () => {
    const entries = entriesOfDay(
      LocalDate.parse('2026-10-23'),
      LIMA,
      [
        appointment('confirmed', {
          id: 'late',
          start: '2026-10-24T03:00:00Z',
          end: '2026-10-24T03:45:00Z',
        }),
        appointment('confirmed', {
          id: 'next-day',
          start: '2026-10-24T06:00:00Z',
          end: '2026-10-24T06:45:00Z',
        }),
        appointment('confirmed', {
          id: 'a-2',
          start: '2026-10-23T18:00:00Z',
          staffMemberId: 'm-2',
          customerId: 'c-gone',
        }),
      ],
      [timeBlock('m-2')],
      sources,
    );

    expect(entries.map((e) => `${e.kind}:${e.id}`)).toEqual([
      'block:b-1',
      'appointment:a-2',
      'appointment:late',
    ]);
    const conflicted = entries[1];
    expect(conflicted.kind === 'appointment' && conflicted.conflict).toEqual({
      whole: false,
      name: 'Kevin',
    });
    expect(conflicted.kind === 'appointment' && conflicted.customerDeleted).toBe(true);
    expect(conflicted.kind === 'appointment' && conflicted.memberIndex).toBe(1);
  });

  it('cuts a block of several days to the day drawn', () => {
    const [entry] = entriesOfDay(
      LocalDate.parse('2026-10-23'),
      LIMA,
      [],
      [timeBlock(null, '2026-10-22T15:00:00Z', '2026-10-25T15:00:00Z')],
      sources,
    );
    expect(entry.start.toISOString()).toBe('2026-10-23T05:00:00.000Z');
    expect(entry.end.toISOString()).toBe('2026-10-24T05:00:00.000Z');
    expect(entry.kind === 'block' && entry.memberName).toBeNull();
  });
});
