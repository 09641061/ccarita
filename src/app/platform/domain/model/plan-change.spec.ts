import { ChangePlan, PlanChange, changePlanProblem } from './plan-change';

const change = (overrides: Partial<ChangePlan>): ChangePlan => ({
  plan: null,
  period: { kind: 'extend', days: 30 },
  note: 'Yape 2026-10-23',
  ...overrides,
});

describe('changePlanProblem', () => {
  it('O5: a note is required and at most 500 characters', () => {
    expect(changePlanProblem(change({}))).toBeNull();
    expect(changePlanProblem(change({ note: '   ' }))).toBe('note');
    expect(changePlanProblem(change({ note: 'x'.repeat(501) }))).toBe('noteLength');
  });

  it('extends by 1 to 3660 whole days', () => {
    expect(changePlanProblem(change({ period: { kind: 'extend', days: 0 } }))).toBe('days');
    expect(changePlanProblem(change({ period: { kind: 'extend', days: 3661 } }))).toBe('days');
    expect(changePlanProblem(change({ period: { kind: 'extend', days: 1.5 } }))).toBe('days');
    expect(changePlanProblem(change({ period: { kind: 'extend', days: 3660 } }))).toBeNull();
  });

  it('refuses a change of nothing, as pibble does', () => {
    expect(changePlanProblem(change({ period: { kind: 'keep' } }))).toBe('nothing');
    expect(changePlanProblem(change({ plan: 'max', period: { kind: 'keep' } }))).toBeNull();
    expect(
      changePlanProblem(change({ period: { kind: 'until', activeUntil: new Date(0) } })),
    ).toBeNull();
  });
});

describe('PlanChange', () => {
  const entry = (
    from: string | null,
    to: string | null,
    plans: ['max' | 'standard', 'max' | 'standard'],
  ) =>
    new PlanChange(
      'pc-1',
      plans[0],
      plans[1],
      from ? new Date(from) : null,
      to ? new Date(to) : null,
      'Yape',
      'ops@takodu.pe',
      new Date('2026-10-26T15:00:00Z'),
    );

  it('tells a plan change, a new end and a stopped plan apart', () => {
    const extended = entry('2026-11-01T05:00:00Z', '2026-12-01T05:00:00Z', ['max', 'max']);
    expect([extended.planChanged, extended.endChanged, extended.ended]).toEqual([
      false,
      true,
      false,
    ]);

    const downgrade = entry('2026-11-01T05:00:00Z', '2026-11-01T05:00:00Z', ['max', 'standard']);
    expect([downgrade.planChanged, downgrade.endChanged, downgrade.ended]).toEqual([
      true,
      false,
      false,
    ]);

    const stopped = entry('2026-11-01T05:00:00Z', '2026-10-26T14:00:00Z', ['max', 'max']);
    expect(stopped.ended).toBe(true);
  });
});
