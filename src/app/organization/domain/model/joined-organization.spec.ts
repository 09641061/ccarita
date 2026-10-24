import { JoinedOrganization } from './joined-organization';
import { Organization } from './organization';

const until = new Date('2026-11-06T05:00:00Z');

describe('plan activity (O5)', () => {
  const joined = new JoinedOrganization('org-1', 'Barbería Don Lucho', until, 'm-1', 'owner');
  const organization = new Organization('org-1', 'Barbería Don Lucho', 'standard', until);

  it('is active before the end', () => {
    expect(joined.planActive(new Date('2026-11-06T04:59:59Z'))).toBe(true);
    expect(organization.planActive(new Date('2026-11-06T04:59:59Z'))).toBe(true);
  });

  it('ends exactly at the end instant', () => {
    expect(joined.planActive(until)).toBe(false);
    expect(organization.planActive(until)).toBe(false);
  });

  it('stays ended afterwards', () => {
    expect(joined.planActive(new Date('2026-12-01T00:00:00Z'))).toBe(false);
  });
});
