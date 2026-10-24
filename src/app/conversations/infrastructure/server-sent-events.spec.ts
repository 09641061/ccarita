import { ServerSentEvents } from './server-sent-events';

describe('ServerSentEvents', () => {
  it('returns the data of each complete event', () => {
    const events = new ServerSentEvents();
    expect(events.push('data:{"type":"ping"}\n\ndata: {"type":"x"}\n\n')).toEqual([
      '{"type":"ping"}',
      '{"type":"x"}',
    ]);
  });

  it('keeps an event cut in two until its blank line arrives', () => {
    const events = new ServerSentEvents();
    expect(events.push('data:{"ty')).toEqual([]);
    expect(events.push('pe":"ping"}\r\n')).toEqual([]);
    expect(events.push('\r\n')).toEqual(['{"type":"ping"}']);
  });

  it('joins multi-line data and ignores comments and other fields', () => {
    const events = new ServerSentEvents();
    expect(events.push(': keep-alive\n\nevent: change\nid: 7\ndata: a\ndata: b\n\n')).toEqual([
      'a\nb',
    ]);
  });
});
