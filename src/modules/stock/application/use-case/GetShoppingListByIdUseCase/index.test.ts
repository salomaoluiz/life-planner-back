import { NotFoundException } from '@nestjs/common';

import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import { toListDetail } from '@stock/application/service/ShoppingListView';
import { ShoppingListRowOrigins } from '@stock/domain/entity/ShoppingListRowEntity';
import { StockUnits } from '@stock/domain/entity/StockEntity';

import { category, mocks, setup, shoppingList, shoppingRow } from './index.mocks';

const list = shoppingList('l', { isDefault: true });
const milk = {
  categoryId: 'cheese',
  description: 'Milk',
  estimatedUnitPriceCents: 489,
  id: 'milk',
  idealQuantity: 8,
  minQuantity: 3,
  owner: OwnerType.USER,
  ownerId: 'user-id',
  quantity: 2,
  unit: StockUnits.UNIT,
};

it('SHOULD group the rows by top-level category with subtotals, totals and "Outros" last', async () => {
  mocks.lists.findById.mockResolvedValue(list);
  mocks.catalog.findCategories.mockResolvedValue([
    category('dairy', { name: 'Dairy' }),
    category('cheese', { name: 'Cheese', parentId: 'dairy' }),
  ]);
  mocks.lists.findRowsByLists.mockResolvedValue([
    shoppingRow('r1', list, { item: milk, origin: ShoppingListRowOrigins.AUTO, quantity: 6 }),
    shoppingRow('r2', list, { description: 'Candle', price: 1800 }),
  ]);

  const detail = await setup.execute({ accessibleOwners: mocks.accessibleOwners, id: 'l' });

  expect(detail.totals).toEqual({
    autoCount: 1,
    estimatedTotalCents: 2934 + 1800,
    forecastCount: 0,
    pricedCount: 2,
    rowCount: 2,
  });
  expect(detail.groups.map((group) => group.category?.name)).toEqual(['Dairy', undefined]);
  expect(detail.groups[0].rows[0]).toMatchObject({
    estimateCents: 2934,
    priceSource: 'MANUAL',
    stock: { categoryPath: 'Dairy / Cheese', minQuantity: 3, quantity: 2 },
  });
  expect(detail.groups[0].subtotalCents).toBe(2934);
});

it('SHOULD answer 404 WHEN the list is missing or unreachable', async () => {
  mocks.lists.findById.mockResolvedValueOnce(undefined);
  await expect(
    setup.execute({ accessibleOwners: mocks.accessibleOwners, id: 'x' }),
  ).rejects.toThrow(NotFoundException);
  mocks.lists.findById.mockResolvedValueOnce(list);
  await expect(setup.execute({ accessibleOwners: [], id: 'l' })).rejects.toThrow(NotFoundException);
});

it('SHOULD show the projection of a FORECAST row AND the next trip from the closed purchases', async () => {
  const today = new Date('2026-11-25T00:00:00.000Z');
  const forecastItem = {
    ...milk,
    forecast: { dailyRate: 0.5, minDate: new Date('2026-11-29T00:00:00.000Z'), wasteRatio90d: 0.4 },
    quantity: 6,
  };

  mocks.lists.findById.mockResolvedValue(list);
  mocks.catalog.findCategories.mockResolvedValue([category('cheese', { name: 'Cheese' })]);
  mocks.lists.findRowsByLists.mockResolvedValue([
    shoppingRow('r1', list, { item: forecastItem, origin: ShoppingListRowOrigins.FORECAST }),
  ]);
  mocks.lists.findClosedPurchaseDates.mockResolvedValue(
    new Map([
      [
        'l',
        [
          new Date('2026-11-22T00:00:00.000Z'),
          new Date('2026-11-15T00:00:00.000Z'),
          new Date('2026-11-08T00:00:00.000Z'),
        ],
      ],
    ]),
  );

  const detail = toListDetail(
    list,
    await mocks.lists.findRowsByLists(['l']),
    [category('cheese', { name: 'Cheese' })],
    (await mocks.lists.findClosedPurchaseDates(['l'])).get('l'),
    today,
  );
  const row = detail.groups[0].rows[0];

  expect(detail.schedule).toEqual({
    nextTripDate: new Date('2026-11-29T00:00:00.000Z'),
    suggestedIntervalDays: 7,
  });
  expect(row.origin).toBe(ShoppingListRowOrigins.FORECAST);
  // 6 - 0.5 * 4 days = 4
  expect(row.forecast).toEqual({
    minDate: new Date('2026-11-29T00:00:00.000Z'),
    nextTripDate: new Date('2026-11-29T00:00:00.000Z'),
    projectedOnTrip: 4,
  });
  expect(row.wasteRatio90d).toBe(0.4);
  expect(detail.totals.forecastCount).toBe(1);
});
