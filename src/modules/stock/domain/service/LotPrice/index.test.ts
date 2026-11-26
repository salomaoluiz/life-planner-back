import { averageLotPrice, discardValue } from '@stock/domain/service/LotPrice';

describe('averageLotPrice', () => {
  it('SHOULD average by quantity, half-up', () => {
    // 3 at 200 + 1 at 300 = 225
    expect(
      averageLotPrice({ quantity: 3, unitPriceCents: 200 }, { quantity: 1, unitPriceCents: 300 }),
    ).toBe(225);
    // 1 at 100 + 2 at 101 = 100.67 -> 101
    expect(
      averageLotPrice({ quantity: 1, unitPriceCents: 100 }, { quantity: 2, unitPriceCents: 101 }),
    ).toBe(101);
    // 1 at 100 + 1 at 101 = 100.5 -> 101 (half-up)
    expect(
      averageLotPrice({ quantity: 1, unitPriceCents: 100 }, { quantity: 1, unitPriceCents: 101 }),
    ).toBe(101);
  });

  it('SHOULD keep the lot price WHEN the entry has none', () => {
    expect(averageLotPrice({ quantity: 3, unitPriceCents: 200 }, { quantity: 1 })).toBe(200);
    expect(averageLotPrice({ quantity: 3 }, { quantity: 1 })).toBeUndefined();
  });

  it('SHOULD take the entry price WHEN the lot has none or is empty', () => {
    expect(averageLotPrice({ quantity: 3 }, { quantity: 1, unitPriceCents: 300 })).toBe(300);
    expect(
      averageLotPrice({ quantity: 0, unitPriceCents: 100 }, { quantity: 1, unitPriceCents: 300 }),
    ).toBe(300);
  });
});

describe('discardValue', () => {
  it('SHOULD use the lot price first', () => {
    expect(discardValue({ lotCurrency: 'BRL', lotPriceCents: 489, quantity: 1 })).toEqual({
      currency: 'BRL',
      source: 'LOT',
      valueCents: 489,
    });
  });

  it('SHOULD round the value half-up for fractional quantities', () => {
    // 0.5 kg at 489 = 244.5 -> 245
    expect(discardValue({ lotCurrency: 'BRL', lotPriceCents: 489, quantity: 0.5 }).valueCents).toBe(
      245,
    );
  });

  it('SHOULD fall back to the last price of the item with its own currency', () => {
    expect(
      discardValue({ lastPrice: { currency: 'EUR', unitPriceCents: 300 }, quantity: 2 }),
    ).toEqual({ currency: 'EUR', source: 'ITEM_LAST', valueCents: 600 });
  });

  it('SHOULD be NONE without any price', () => {
    expect(discardValue({ quantity: 1 })).toEqual({ source: 'NONE' });
  });
});
