import { StockUnits } from '@stock/domain/entity/StockEntity';

import { mapOpenFoodFacts, parsePackageQuantity } from './index';

describe('parsePackageQuantity', () => {
  it.each([
    ['500 g', 0.5, StockUnits.KILOGRAM],
    ['1,5 kg', 1.5, StockUnits.KILOGRAM],
    ['250ml', 0.25, StockUnits.LITER],
    ['1 L', 1, StockUnits.LITER],
    ['12', 12, StockUnits.UNIT],
  ])('SHOULD map %s', (input, packageQuantity, unit) => {
    expect(parsePackageQuantity(input)).toEqual({ packageQuantity, unit });
  });

  it.each([undefined, '', 'a bunch', '3 oz', '0 g'])('SHOULD ignore %j', (input) => {
    expect(parsePackageQuantity(input)).toEqual({});
  });
});

describe('mapOpenFoodFacts', () => {
  it('SHOULD use the first brand and trim the name to 100 characters', () => {
    const result = mapOpenFoodFacts({
      brands: 'Marca, Outra',
      name: `  ${'x'.repeat(120)} `,
      quantity: '1 kg',
    });

    expect(result.brand).toBe('Marca');
    expect(result.description).toHaveLength(100);
    expect(result.unit).toBe(StockUnits.KILOGRAM);
  });

  it('SHOULD omit what is missing', () => {
    expect(mapOpenFoodFacts({})).toEqual({});
  });
});
