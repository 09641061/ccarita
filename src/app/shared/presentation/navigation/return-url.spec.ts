import { safeReturnUrl } from './return-url';

describe('safeReturnUrl', () => {
  it('keeps a path inside the app', () => {
    expect(safeReturnUrl('/clientes?q=ana')).toBe('/clientes?q=ana');
  });

  it('replaces another origin, a protocol-relative address or nothing', () => {
    expect(safeReturnUrl('https://evil.test')).toBe('/');
    expect(safeReturnUrl('//evil.test')).toBe('/');
    expect(safeReturnUrl('/\\evil.test')).toBe('/');
    expect(safeReturnUrl(undefined, '/agenda')).toBe('/agenda');
  });
});
