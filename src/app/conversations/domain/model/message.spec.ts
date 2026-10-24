import { message } from '../../../../testing/conversation-fixtures';

describe('Message', () => {
  it('serves media only for the kinds that carry a file', () => {
    expect(message({ kind: 'image', hasMedia: true }).carriesMedia).toBe(true);
    expect(message({ kind: 'document', hasMedia: true }).carriesMedia).toBe(true);
    expect(message({ kind: 'image', hasMedia: false }).carriesMedia).toBe(false);
    expect(message({ kind: 'location', hasMedia: true }).carriesMedia).toBe(false);
  });

  it('W10: names outbound and failed messages', () => {
    expect(message().outbound).toBe(false);
    expect(message({ direction: 'out', status: 'failed' }).failed).toBe(true);
  });
});
