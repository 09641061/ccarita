import { conversation } from '../../../testing/conversation-fixtures';
import { conversationStatus } from './conversation-status';

const NOW = new Date('2026-10-24T15:00:00Z');

describe('conversationStatus', () => {
  it('puts a deleted customer, then a handoff, then a pause, then the window', () => {
    const until = new Date('2026-10-25T02:00:00Z');
    expect(
      conversationStatus(conversation({ customerDeleted: true, assistantHandedOff: true }), NOW)
        .key,
    ).toBe('mediaRemoved');
    expect(conversationStatus(conversation({ assistantHandedOff: true }), NOW)).toMatchObject({
      key: 'handedOff',
      warning: true,
    });
    expect(
      conversationStatus(
        conversation({ assistantPausedManually: true, assistantPausedByMemberId: 'm-1' }),
        NOW,
      ),
    ).toMatchObject({ key: 'pausedManually', memberId: 'm-1' });
    expect(conversationStatus(conversation({ assistantPausedUntil: until }), NOW)).toMatchObject({
      key: 'pausedForHuman',
      until,
    });
    expect(
      conversationStatus(conversation({ lastInboundAt: new Date('2026-10-22T15:00:00Z') }), NOW)
        .key,
    ).toBe('windowClosed');
    expect(conversationStatus(conversation(), NOW)).toMatchObject({
      key: 'windowOpen',
      until: new Date('2026-10-25T14:00:00Z'),
    });
  });
});
