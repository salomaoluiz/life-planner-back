import { BadRequestException } from '@nestjs/common';

import {
  accessibleOwners,
  archivedOwners,
  build,
  catalogRepositoryMock,
  category,
  stockRepositoryMock,
} from '@stock/application/mocks/stock.mocks';

import { GetWasteUseCase } from './index';

const mocks = { catalog: catalogRepositoryMock(), stock: stockRepositoryMock() };
let setup: GetWasteUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  mocks.catalog.findCatalogByOwners.mockResolvedValue({
    categories: [
      category('veg', { name: 'Hortifrúti' }),
      category('leaf', { name: 'Folhas', parentId: 'veg' }),
    ],
    locations: [],
    shoppingLists: [],
  });
  setup = await build(GetWasteUseCase, [
    { provide: 'IStockRepository', useValue: mocks.stock },
    { provide: 'IStockCatalogRepository', useValue: mocks.catalog },
  ]);
});

it('SHOULD read the month with its bounds AND the previous month in the same range', async () => {
  await setup.execute({ accessibleOwners, month: '2026-01', today: '2026-11-25' });

  expect(mocks.stock.findWasteGroups).toHaveBeenCalledWith(accessibleOwners, {
    from: new Date('2026-01-01T00:00:00.000Z'),
    previousFrom: new Date('2025-12-01T00:00:00.000Z'),
    to: new Date('2026-02-01T00:00:00.000Z'),
  });
  expect(mocks.stock.findWasteItems).toHaveBeenCalledWith(accessibleOwners, {
    from: new Date('2026-01-01T00:00:00.000Z'),
    to: new Date('2026-02-01T00:00:00.000Z'),
  });
});

it('SHOULD default to the current month AND answer 400 for a month after it', async () => {
  const report = await setup.execute({ accessibleOwners, today: '2026-11-25' });

  expect(report.month).toBe('2026-11');
  await expect(
    setup.execute({ accessibleOwners, month: '2026-12', today: '2026-11-25' }),
  ).rejects.toBeInstanceOf(BadRequestException);
});

it('SHOULD fold the categories into their top-level category', async () => {
  mocks.stock.findWasteGroups.mockResolvedValue([
    {
      categoryId: 'leaf',
      count: 2,
      currency: 'BRL',
      items: 1,
      period: 'CURRENT',
      scope: 'CATEGORY',
      unpriced: 0,
      valueCents: 700,
    },
  ]);

  const report = await setup.execute({ accessibleOwners, today: '2026-11-25' });

  expect(report.byCategory).toEqual([
    {
      category: { id: 'veg', name: 'Hortifrúti' },
      count: 2,
      totals: [{ currency: 'BRL', valueCents: 700 }],
    },
  ]);
});

it('SHOULD hide archived families from "Todas" AND reach one by its id', async () => {
  await setup.execute({ accessibleOwners: archivedOwners, today: '2026-11-25' });
  expect(mocks.stock.findWasteGroups.mock.calls[0][0]).toEqual([archivedOwners[0]]);

  await setup.execute({
    accessibleOwners: archivedOwners,
    ownerId: 'family-id',
    today: '2026-11-25',
  });
  expect(mocks.stock.findWasteGroups.mock.calls[1][0]).toEqual([archivedOwners[1]]);
});

it('SHOULD return every item WHEN topLimit is all', async () => {
  mocks.stock.findWasteItems.mockResolvedValue(
    Array.from({ length: 7 }, (_, index) => ({
      count: 1,
      currency: 'BRL',
      description: `Item ${index}`,
      itemId: `i${index}`,
      quantity: 1,
      reason: 'EXPIRED',
      unit: 'unit',
      valueCents: 100 + index,
    })),
  );

  const report = await setup.execute({ accessibleOwners, today: '2026-11-25', topLimit: 'all' });

  expect(report.topItems).toHaveLength(7);
  expect(report.moreItemsCount).toBe(0);
});
