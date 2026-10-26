import { priceCentsOf, priceTextOf } from './service-details';

describe('priceCentsOf', () => {
  it('O14: turns soles typed with a dot or a comma into whole céntimos', () => {
    expect(priceCentsOf('35')).toBe(3500);
    expect(priceCentsOf('35.5')).toBe(3550);
    expect(priceCentsOf('35,50')).toBe(3550);
    expect(priceCentsOf(' S/ 0.10 ')).toBe(10);
    expect(priceCentsOf('0')).toBe(0);
  });

  it('never goes through floating point', () => {
    expect(priceCentsOf('19.99')).toBe(1999);
    expect(priceCentsOf('1000000')).toBe(100_000_000);
  });

  it('refuses what is not a price, negatives and more than pibble allows', () => {
    expect(priceCentsOf('')).toBeNull();
    expect(priceCentsOf('-5')).toBeNull();
    expect(priceCentsOf('3.555')).toBeNull();
    expect(priceCentsOf('abc')).toBeNull();
    expect(priceCentsOf('1000000.01')).toBeNull();
  });
});

describe('priceTextOf', () => {
  it('shows céntimos as soles with two decimals', () => {
    expect(priceTextOf(3500)).toBe('35.00');
    expect(priceTextOf(5)).toBe('0.05');
  });
});
