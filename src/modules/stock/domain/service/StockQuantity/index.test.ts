import { StockUnits } from '@stock/domain/entity/StockEntity';

import { fromMilli, quantityError, toMilli } from './index';

describe('toMilli / fromMilli', () => {
  it('SHOULD round-trip decimals without float drift', () => {
    expect(toMilli(0.1 + 0.2)).toBe(300);
    expect(fromMilli(1500)).toBe(1.5);
  });
});

describe('quantityError', () => {
  it('SHOULD refuse decimals on UNIT items', () => {
    expect(quantityError(StockUnits.UNIT, 1.5)).toBe('Unit quantities must be whole numbers');
    expect(quantityError(StockUnits.UNIT, 3)).toBeUndefined();
  });

  it.each([StockUnits.KILOGRAM, StockUnits.LITER])(
    'SHOULD accept up to 3 decimals on %s and refuse 4',
    (unit) => {
      expect(quantityError(unit, 0.001)).toBeUndefined();
      expect(quantityError(unit, 1.5)).toBeUndefined();
      expect(quantityError(unit, 0.0004)).toBe('Quantities accept up to 3 decimals');
    },
  );
});
