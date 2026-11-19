import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import StockEntityFixture from '@stock/domain/entity/mocks/StockEntity.fixture';
import StockLotEntityFixture from '@stock/domain/entity/mocks/StockLotEntity.fixture';
import StockCategoryEntity, { StockCatalogStatus } from '@stock/domain/entity/StockCategoryEntity';
import StockLocationEntity from '@stock/domain/entity/StockLocationEntity';

import { todayUtc, toStockItemView } from './index';

function day(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}
const today = day('2026-11-10');
const date = day('2026-01-01');
function lot(id: string, quantity: number, extra: object = {}) {
  const fixture = new StockLotEntityFixture().withId(id).withQuantity(quantity).build();

  return Object.assign(fixture, extra);
}
const catalog = {
  categories: [
    new StockCategoryEntity({
      createdAt: date,
      id: 'dairy',
      name: 'Dairy',
      owner: OwnerType.USER,
      ownerId: 'u',
      status: StockCatalogStatus.ACTIVE,
      updatedAt: date,
    }),
    new StockCategoryEntity({
      createdAt: date,
      id: 'cheese',
      name: 'Cheese',
      owner: OwnerType.USER,
      ownerId: 'u',
      parentId: 'dairy',
      status: StockCatalogStatus.ARCHIVED,
      updatedAt: date,
    }),
  ],
  locations: [
    new StockLocationEntity({
      createdAt: date,
      id: 'fridge',
      name: 'Fridge',
      owner: OwnerType.USER,
      ownerId: 'u',
      status: StockCatalogStatus.ACTIVE,
      updatedAt: date,
    }),
  ],
  shoppingLists: [],
};

it('SHOULD sum the open lots, ignore empty ones and order open lots first', () => {
  const item = new StockEntityFixture()
    .withOpenedShelfLifeDays(5)
    .withLots([
      lot('c-late', 2, { expirationDate: day('2026-12-30') }),
      lot('empty', 0),
      lot('open', 1, { expirationDate: day('2026-12-30'), openedAt: day('2026-11-09') }),
      lot('c-none', 1),
      lot('c-soon', 1, { expirationDate: day('2026-11-12') }),
    ])
    .build();

  const view = toStockItemView(item, today, catalog);

  expect(view.quantity).toBe(5);
  expect(view.lots.map((entry) => entry.lot.id)).toEqual(['open', 'c-soon', 'c-late', 'c-none']);
  expect(view.hasOpenLot).toBe(true);
  expect(view.nearestExpiration).toEqual(day('2026-11-12'));
  expect(view.expirationStatus).toBe('EXPIRING');
});

it('SHOULD flag restock, pick the category path and archived flags, and the location', () => {
  const item = new StockEntityFixture()
    .withCategoryId('cheese')
    .withLocationId('fridge')
    .withMinQuantity(2, 5)
    .withLots([lot('a', 2)])
    .build();

  const view = toStockItemView(item, today, catalog);

  expect(view.needsRestock).toBe(true);
  expect(view.restockQuantity).toBe(3);
  expect(view.category).toEqual({
    archived: true,
    id: 'cheese',
    name: 'Cheese',
    path: 'Dairy / Cheese',
  });
  expect(view.location).toEqual({ archived: false, id: 'fridge', name: 'Fridge' });
});

it('SHOULD handle an item with no lots, category or location', () => {
  const view = toStockItemView(new StockEntityFixture().build(), today, catalog);

  expect(view).toMatchObject({
    expirationStatus: 'NONE',
    hasOpenLot: false,
    needsRestock: true,
    quantity: 0,
  });
  expect(view.category).toBeUndefined();
  expect(view.location).toBeUndefined();
});

it('SHOULD order lots with equal dates by id and undated lots last', () => {
  const item = new StockEntityFixture()
    .withLots([
      lot('b', 1, { expirationDate: today }),
      lot('a', 1, { expirationDate: today }),
      lot('z', 1),
      lot('y', 1),
    ])
    .build();

  expect(toStockItemView(item, today, catalog).lots.map((entry) => entry.lot.id)).toEqual([
    'a',
    'b',
    'y',
    'z',
  ]);
});

it('SHOULD return today at UTC midnight', () => {
  expect(todayUtc().toISOString()).toMatch(/T00:00:00.000Z$/);
});
