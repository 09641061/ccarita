import { Money } from './money';

describe('Money', () => {
  it('formats soles from cents', () => {
    expect(new Money(3500, 'PEN').format()).toBe('S/\u00a035.00');
  });

  it('refuses fractions of a cent', () => {
    expect(() => new Money(35.5, 'PEN')).toThrow();
  });
});
