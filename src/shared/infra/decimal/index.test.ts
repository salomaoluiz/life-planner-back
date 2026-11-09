import { Decimal8, roundDiv } from './index';

describe('Decimal8', () => {
  it('SHOULD parse and print exact values with up to 8 places', () => {
    expect(Decimal8.parse('18.3572').toFixed8()).toBe('18.35720000');
    expect(Decimal8.parse('18.35720000').toString()).toBe('18.3572');
    expect(Decimal8.parse('1200').toString()).toBe('1200');
    expect(Decimal8.parse('9999999999.99999999').toFixed8()).toBe('9999999999.99999999');
    expect(Decimal8.parse('0.1').plus(Decimal8.parse('0.2')).toString()).toBe('0.3');
  });

  it('SHOULD reject more than 8 decimals, signs and non numbers', () => {
    expect(() => Decimal8.parse('1.123456789')).toThrow('Invalid decimal');
    expect(() => Decimal8.parse('-1')).toThrow('Invalid decimal');
    expect(() => Decimal8.parse('abc')).toThrow('Invalid decimal');
    expect(() => Decimal8.parse('')).toThrow('Invalid decimal');
  });

  it('SHOULD compare, add, subtract and report sign', () => {
    const one = Decimal8.parse('1');
    const two = Decimal8.parse('2');

    expect(one.compare(two)).toBe(-1);
    expect(two.compare(one)).toBe(1);
    expect(one.compare(Decimal8.parse('1.0'))).toBe(0);
    expect(two.minus(one).toString()).toBe('1');
    expect(one.minus(two).toFixed8()).toBe('-1.00000000');
    expect(Decimal8.zero().isZero()).toBe(true);
    expect(one.isPositive()).toBe(true);
    expect(Decimal8.fromScaled(5n).toFixed8()).toBe('0.00000005');
  });

  it('SHOULD multiply to cents rounding half up', () => {
    expect(Decimal8.parse('500').mulToCents(Decimal8.parse('10.20'))).toBe(510000);
    expect(Decimal8.parse('300').mulToCents(Decimal8.parse('10.90'))).toBe(327000);
    expect(Decimal8.parse('3').mulToCents(Decimal8.parse('0.1'))).toBe(30);
    // 0.5 cent rounds up
    expect(Decimal8.parse('1').mulToCents(Decimal8.parse('0.005'))).toBe(1);
    expect(Decimal8.parse('1').mulToCents(Decimal8.parse('0.0049'))).toBe(0);
  });

  it('SHOULD round integer division half up', () => {
    expect(roundDiv(5n, 2n)).toBe(3n);
    expect(roundDiv(4n, 3n)).toBe(1n);
    expect(roundDiv(7n, 3n)).toBe(2n);
  });
});
