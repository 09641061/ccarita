import { Slot } from './slot';

describe('Slot', () => {
  const lima = 'America/Lima';
  const slot = (start: string, free: string[] = ['m-1']) =>
    new Slot(new Date(start), new Date(new Date(start).getTime() + 45 * 60_000), free);

  it('says which members are free for the whole service (B16)', () => {
    const s = slot('2026-10-23T16:45:00Z', ['m-1', 'm-2']);
    expect(s.isFree('m-2')).toBe(true);
    expect(s.isFree('m-3')).toBe(false);
  });

  it('splits the day at noon in the establishment zone, not UTC', () => {
    // 16:45 UTC is 11:45 in Lima; 17:00 UTC is noon.
    expect(slot('2026-10-23T16:45:00Z').partOfDay(lima)).toBe('morning');
    expect(slot('2026-10-23T17:00:00Z').partOfDay(lima)).toBe('afternoon');
  });
});
