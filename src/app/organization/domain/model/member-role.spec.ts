import { canPerform, MemberAction } from './member-role';

const ACTIONS: MemberAction[] = [
  'editOrganization',
  'manageEstablishments',
  'connectWhatsapp',
  'editSettings',
  'manageTeam',
  'seeAllEstablishments',
  'manageEveryonesCalendar',
  'deleteCustomers',
];

describe('canPerform (03 §5)', () => {
  it('lets the owner do everything', () => {
    expect(ACTIONS.every((action) => canPerform('owner', action))).toBe(true);
  });

  it('keeps the organization, establishments and WhatsApp from managers', () => {
    expect(ACTIONS.filter((action) => !canPerform('manager', action))).toEqual([
      'editOrganization',
      'manageEstablishments',
      'connectWhatsapp',
    ]);
  });

  it('gives staff none of these actions', () => {
    expect(ACTIONS.some((action) => canPerform('staff', action))).toBe(false);
  });
});
