import { StockUnits } from '@stock/domain/entity/StockEntity';

import ShoppingListRowEntity, { ShoppingListRowOrigins } from './index';

it('SHOULD keep every property', () => {
  const date = new Date('2026-11-10T00:00:00.000Z');
  const row = new ShoppingListRowEntity({
    createdAt: date,
    description: 'Candle',
    id: 'r',
    listId: 'l',
    origin: ShoppingListRowOrigins.MANUAL,
    quantity: 2,
    unit: StockUnits.UNIT,
    updatedAt: date,
  });

  expect(row).toMatchObject({ description: 'Candle', origin: 'MANUAL', quantity: 2 });
});
