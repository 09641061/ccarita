import { conversation } from '../../../../testing/conversation-fixtures';
import { templateChoices } from './template-choice';
import { WhatsappLine } from './whatsapp-line';

const NOW = new Date('2026-10-24T15:00:00Z');
const line = (templates: Record<string, string>) =>
  new WhatsappLine(
    'l-1',
    'est-1',
    '+51 1 555 0000',
    'coexistence',
    true,
    templates as WhatsappLine['templates'],
  );

describe('templateChoices', () => {
  it('W6: outside the window both go as templates and need approval', () => {
    const closed = conversation({ lastInboundAt: new Date('2026-10-22T15:00:00Z') });
    expect(
      templateChoices(closed, line({ reminder: 'approved', confirmation: 'pending' }), NOW),
    ).toEqual([
      { template: 'reminder', status: 'approved', asTemplate: true, sendable: true },
      { template: 'confirmation', status: 'pending', asTemplate: true, sendable: false },
    ]);
  });

  it('W6: inside the window a confirmation goes as text, a reminder still as a template', () => {
    const open = conversation();
    expect(
      templateChoices(open, line({ reminder: 'rejected', confirmation: 'pending' }), NOW),
    ).toEqual([
      { template: 'reminder', status: 'rejected', asTemplate: true, sendable: false },
      { template: 'confirmation', status: 'pending', asTemplate: false, sendable: true },
    ]);
  });

  it('offers no template while the line is unknown', () => {
    const closed = conversation({ lastInboundAt: null });
    expect(templateChoices(closed, null, NOW).map((c) => [c.status, c.sendable])).toEqual([
      [null, false],
      [null, false],
    ]);
  });
});
