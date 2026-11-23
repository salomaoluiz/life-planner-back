import { expandUpcE, isValidGtin, normalizeBarcode } from './index';

describe('isValidGtin', () => {
  it('SHOULD accept a correct EAN-13 and refuse a wrong digit', () => {
    expect(isValidGtin('7891000100103')).toBe(true);
    expect(isValidGtin('7891000100104')).toBe(false);
  });
});

describe('normalizeBarcode', () => {
  it('SHOULD trim and drop spaces and hyphens', () => {
    expect(normalizeBarcode(' 7891000 100-103 ')).toBe('7891000100103');
  });

  it('SHOULD store a 12-digit UPC-A as 13 digits with a leading zero', () => {
    expect(normalizeBarcode('036000291452')).toBe('0036000291452');
    expect(normalizeBarcode('0036000291452')).toBe('0036000291452');
  });

  it('SHOULD return undefined for a numeric 8/13/14 code with a wrong check digit', () => {
    expect(normalizeBarcode('7891000100104')).toBeUndefined();
    expect(normalizeBarcode('96385074')).toBe('96385074');
    expect(normalizeBarcode('96385075')).toBeUndefined();
  });

  it('SHOULD keep other codes as typed, uppercased', () => {
    expect(normalizeBarcode('abc123')).toBe('ABC123');
    expect(normalizeBarcode('12345')).toBe('12345');
  });

  it.each(['', '   ', 'a$b', 'x'.repeat(65)])('SHOULD refuse %j', (value) => {
    expect(normalizeBarcode(value)).toBeUndefined();
  });
});

describe('expandUpcE', () => {
  it.each([
    ['04252614', '042100005264'],
    ['01234565', '012345000065'],
  ])('SHOULD expand %s to %s', (input, expected) => {
    expect(expandUpcE(input)).toBe(expected);
  });
});
