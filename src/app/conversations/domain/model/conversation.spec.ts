import { conversation } from '../../../../testing/conversation-fixtures';
import { Conversation } from './conversation';

const NOW = new Date('2026-10-24T15:00:00Z');

describe('Conversation', () => {
  it('W6: keeps the window open until the time pibble says it closes', () => {
    const c = conversation({ windowClosesAt: new Date('2026-10-24T15:00:01Z') });
    expect(c.windowOpen(NOW)).toBe(true);
    expect(c.windowOpen(new Date('2026-10-24T15:00:01Z'))).toBe(false);
  });

  it('W6: has no window before the customer ever wrote', () => {
    expect(conversation({ lastInboundAt: null }).windowOpen(NOW)).toBe(false);
  });

  it('W6: warns once the window closes within four hours', () => {
    const c = conversation({ windowClosesAt: new Date('2026-10-24T19:00:00Z') });
    expect(c.windowClosingSoon(NOW)).toBe(true);
    expect(c.windowClosingSoon(new Date('2026-10-24T14:59:00Z'))).toBe(false);
    expect(c.windowClosingSoon(new Date('2026-10-24T19:00:00Z'))).toBe(false);
  });

  it('allows a reply only in the window, on an active plan, to a customer who exists', () => {
    expect(conversation().canReply(NOW, true)).toBe(true);
    expect(conversation().canReply(NOW, false)).toBe(false);
    expect(conversation({ customerDeleted: true }).canReply(NOW, true)).toBe(false);
    expect(
      conversation({ lastInboundAt: new Date('2026-10-22T15:00:00Z') }).canReply(NOW, true),
    ).toBe(false);
  });

  it('A7, A3: a handoff wins over a manual pause, which wins over the pause after a reply', () => {
    const until = new Date('2026-10-25T02:00:00Z');
    expect(conversation().assistantState(NOW)).toEqual({ kind: 'active' });
    expect(conversation({ assistantPausedUntil: until }).assistantState(NOW)).toEqual({
      kind: 'pausedForHuman',
      until,
    });
    expect(
      conversation({ assistantPausedUntil: new Date('2026-10-24T14:59:00Z') }).assistantState(NOW),
    ).toEqual({ kind: 'active' });
    expect(
      conversation({
        assistantPausedUntil: until,
        assistantPausedManually: true,
        assistantPausedByMemberId: 'm-1',
      }).assistantState(NOW),
    ).toEqual({ kind: 'pausedManually', byMemberId: 'm-1' });
    const handedOff = conversation({
      assistantHandedOff: true,
      handoffSummary: 'Pidió hablar con alguien',
      assistantPausedManually: true,
    });
    expect(handedOff.assistantState(NOW)).toEqual({
      kind: 'handedOff',
      summary: 'Pidió hablar con alguien',
    });
    expect(handedOff.needsSomeone).toBe(true);
  });

  it('W8: reading clears the unread count and keeps the rest', () => {
    const read = conversation().read();
    expect(read).toBeInstanceOf(Conversation);
    expect(read.unreadCount).toBe(0);
    expect(read.customerName).toBe('Rosa Huamán');
  });

  it('W8, A7: awaits a person while the customer wrote last and nobody read it, or after a handoff', () => {
    const at = new Date('2026-10-24T14:00:00Z');
    const later = new Date('2026-10-24T14:00:05Z');
    expect(conversation({ unreadCount: 1, lastInboundAt: at, lastMessageAt: at }).awaitsReply).toBe(
      true,
    );
    expect(
      conversation({ unreadCount: 1, lastInboundAt: at, lastMessageAt: later }).awaitsReply,
    ).toBe(false);
    expect(conversation({ unreadCount: 0, lastInboundAt: at, lastMessageAt: at }).awaitsReply).toBe(
      false,
    );
    expect(
      conversation({
        unreadCount: 0,
        assistantHandedOff: true,
        lastInboundAt: at,
        lastMessageAt: later,
      }).awaitsReply,
    ).toBe(true);
  });
});
