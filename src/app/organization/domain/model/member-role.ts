/** O9: a member has one role in an organization. */
export type MemberRole = 'owner' | 'manager' | 'staff';

/** The actions of the roles table (03 §5) that change what a screen offers. */
export type MemberAction =
  | 'editOrganization'
  | 'manageEstablishments'
  | 'connectWhatsapp'
  | 'editSettings'
  | 'manageTeam'
  | 'seeAllEstablishments'
  | 'manageEveryonesCalendar'
  | 'deleteCustomers';

const OWNER_ONLY: readonly MemberAction[] = [
  'editOrganization',
  'manageEstablishments',
  'connectWhatsapp',
];

/**
 * 03 §5: owners do everything; managers everything but the organization, its establishments and the WhatsApp
 * line; staff none of these actions. pibble enforces the same table; this only decides what to show.
 */
export function canPerform(role: MemberRole, action: MemberAction): boolean {
  if (role === 'owner') return true;
  if (role === 'manager') return !OWNER_ONLY.includes(action);
  return false;
}
