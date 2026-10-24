import { appointment, timeBlock } from '../../../../testing/booking-fixtures';

describe('TimeBlock', () => {
  const during = { start: '2026-10-23T18:30:00Z', end: '2026-10-23T19:15:00Z' };

  it('B15: shows a conflict with a booked appointment of its member', () => {
    expect(timeBlock('m-1').conflictsWith(appointment('confirmed', during))).toBe(true);
    expect(timeBlock('m-2').conflictsWith(appointment('confirmed', during))).toBe(false);
  });

  it('B15: a block of the whole establishment conflicts with everyone', () => {
    const block = timeBlock(null);
    expect(block.coversWholeEstablishment).toBe(true);
    expect(
      block.conflictsWith(appointment('in_progress', { ...during, staffMemberId: 'm-9' })),
    ).toBe(true);
  });

  it('ignores appointments that do not hold time or only touch the block', () => {
    expect(timeBlock('m-1').conflictsWith(appointment('cancelled', during))).toBe(false);
    const touching = { start: '2026-10-23T19:00:00Z', end: '2026-10-23T19:45:00Z' };
    expect(timeBlock('m-1').conflictsWith(appointment('confirmed', touching))).toBe(false);
  });

  it('B15: members manage their own blocks; owners and managers everyone’s', () => {
    expect(timeBlock('m-1').canBeManagedBy('m-1', false)).toBe(true);
    expect(timeBlock('m-2').canBeManagedBy('m-1', false)).toBe(false);
    expect(timeBlock(null).canBeManagedBy('m-1', false)).toBe(false);
    expect(timeBlock(null).canBeManagedBy('m-1', true)).toBe(true);
  });
});
