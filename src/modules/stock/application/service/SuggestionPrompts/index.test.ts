import { StockUnits } from '@stock/domain/entity/StockEntity';

import { SearchAnswerSchema } from './index';

describe('SearchAnswerSchema', () => {
  it('SHOULD turn grams into kilograms AND read a lower case confidence', () => {
    const answer = SearchAnswerSchema.parse({
      confidence: 'high',
      description: 'Leite Condensado',
      packageQuantity: 395,
      unit: 'g',
    });

    expect(answer).toMatchObject({
      confidence: 'HIGH',
      packageQuantity: 0.395,
      unit: StockUnits.KILOGRAM,
    });
  });

  it.each([
    ['ml', 500, 0.5, StockUnits.LITER],
    ['KILOGRAM', 2, 2, StockUnits.KILOGRAM],
    ['kg', 2, 2, StockUnits.KILOGRAM],
    ['L', 1, 1, StockUnits.LITER],
    ['UNIT', 12, 12, StockUnits.UNIT],
  ])('SHOULD map %s %s', (unit, quantity, expectedQuantity, expectedUnit) => {
    expect(SearchAnswerSchema.parse({ packageQuantity: quantity, unit })).toMatchObject({
      packageQuantity: expectedQuantity,
      unit: expectedUnit,
    });
  });

  it('SHOULD drop an unknown unit AND a wrong confidence without failing', () => {
    const answer = SearchAnswerSchema.parse({ confidence: 'maybe', description: 'x', unit: 'oz' });

    expect(answer.unit).toBeUndefined();
    expect(answer.confidence).toBeUndefined();
    expect(answer.description).toBe('x');
  });
});
