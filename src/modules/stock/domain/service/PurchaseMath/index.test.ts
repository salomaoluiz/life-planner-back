import {
  cartTotals,
  lineFromUnit,
  priceChangeNotice,
  priceChangePercent,
  resolvePrice,
  unitFromLine,
} from './index';

describe('lineFromUnit / unitFromLine', () => {
  it('SHOULD round half up both ways', () => {
    expect(lineFromUnit(333, 1.5)).toBe(500);
    expect(unitFromLine(500, 1.5)).toBe(333);
    expect(unitFromLine(1000, 3)).toBe(333);
    expect(unitFromLine(1001, 2)).toBe(501);
  });
});

describe('resolvePrice', () => {
  it('SHOULD compute the line from a typed unit price', () => {
    expect(resolvePrice({ priceInput: 'UNIT', quantity: 3, unitPriceCents: 250 })).toEqual({
      lineTotalCents: 750,
      priceInput: 'UNIT',
      unitPriceCents: 250,
    });
  });

  it('SHOULD compute the unit from a typed line total', () => {
    expect(resolvePrice({ lineTotalCents: 900, quantity: 3 })).toEqual({
      lineTotalCents: 900,
      priceInput: 'LINE',
      unitPriceCents: 300,
    });
  });

  it('SHOULD keep only the typed value without quantity AND nothing without a price', () => {
    expect(resolvePrice({ priceInput: 'UNIT', unitPriceCents: 250 })).toEqual({
      lineTotalCents: undefined,
      priceInput: 'UNIT',
      unitPriceCents: 250,
    });
    expect(resolvePrice({ lineTotalCents: 900 })).toEqual({
      lineTotalCents: 900,
      priceInput: 'LINE',
      unitPriceCents: undefined,
    });
    expect(resolvePrice({ quantity: 2 })).toEqual({});
  });

  it('SHOULD default the input from what was typed', () => {
    expect(resolvePrice({ quantity: 2, unitPriceCents: 100 }).priceInput).toBe('UNIT');
  });
});

describe('priceChangePercent / priceChangeNotice', () => {
  it('SHOULD round the percent AND be null without history or price', () => {
    expect(priceChangePercent(3640, 4290)).toBe(18);
    expect(priceChangePercent(undefined, 100)).toBeNull();
    expect(priceChangePercent(100, undefined)).toBeNull();
  });

  it('SHOULD notice only from ±5 percent', () => {
    expect(priceChangeNotice(null)).toBe('NONE');
    expect(priceChangeNotice(5)).toBe('UP');
    expect(priceChangeNotice(4)).toBe('NONE');
    expect(priceChangeNotice(-5)).toBe('CHEAPER');
    expect(priceChangeNotice(-4)).toBe('NONE');
  });
});

describe('cartTotals', () => {
  it('SHOULD sum the cart rows AND count the unpriced ones', () => {
    expect(
      cartTotals([
        { inCart: true, lineTotalCents: 100 },
        { inCart: true },
        { inCart: false, lineTotalCents: 999 },
      ]),
    ).toEqual({ count: 2, totalCents: 100, unpricedCount: 1 });
  });
});
