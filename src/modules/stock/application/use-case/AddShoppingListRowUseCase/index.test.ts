import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';

import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import { StockCatalogStatus } from '@stock/domain/entity/StockCategoryEntity';
import { StockUnits } from '@stock/domain/entity/StockEntity';

import { item, mocks, setup, shoppingList } from './index.mocks';

const base = { accessibleOwners: mocks.accessibleOwners, listId: 'l', userId: 'user-id' };

it('SHOULD add an item row with the item unit AND report the merge', async () => {
  const result = await setup.execute({ ...base, itemId: 'item', quantity: 6 });

  expect(mocks.lists.addRow).toHaveBeenCalledWith(
    expect.objectContaining({ itemId: 'item', listId: 'l', quantity: 6, userId: 'user-id' }),
  );
  expect(result.merged).toBe(false);
  expect(result.row.description).toBe('Candle');
});

it('SHOULD add a text row (description + unit) and check the quantity precision', async () => {
  await setup.execute({
    ...base,
    description: 'Candle',
    estimatedUnitPriceCents: 1800,
    quantity: 1,
    unit: StockUnits.UNIT,
  });
  expect(mocks.lists.addRow).toHaveBeenCalledWith(
    expect.objectContaining({ description: 'Candle', estimatedUnitPriceCents: 1800 }),
  );

  await expect(
    setup.execute({ ...base, description: 'Rice', quantity: 1.5, unit: StockUnits.UNIT }),
  ).rejects.toThrow(UnprocessableEntityException);
  await expect(
    setup.execute({ ...base, description: 'Rice', quantity: 1.2345, unit: StockUnits.KILOGRAM }),
  ).rejects.toThrow(UnprocessableEntityException);
});

it('SHOULD restore a removed row with its origin (undo)', async () => {
  await setup.execute({ ...base, itemId: 'item', origin: 'AUTO', quantity: 6, restore: true });

  expect(mocks.lists.addRow).toHaveBeenCalledWith(
    expect.objectContaining({ origin: 'AUTO', restore: true }),
  );
});

it('SHOULD refuse an item of another owner, a stock-only item and an archived list (422)', async () => {
  mocks.stock.findById.mockResolvedValueOnce(
    item([], (f) => f.withOwner(OwnerType.FAMILY).withOwnerId('family-id')),
  );
  await expect(setup.execute({ ...base, itemId: 'item', quantity: 1 })).rejects.toThrow(
    UnprocessableEntityException,
  );

  mocks.stock.findById.mockResolvedValueOnce(item([], (f) => f.withStockOnly(true)));
  await expect(setup.execute({ ...base, itemId: 'item', quantity: 1 })).rejects.toThrow(
    UnprocessableEntityException,
  );

  mocks.lists.findById.mockResolvedValueOnce(
    shoppingList('l', { status: StockCatalogStatus.ARCHIVED }),
  );
  await expect(setup.execute({ ...base, itemId: 'item', quantity: 1 })).rejects.toThrow(
    UnprocessableEntityException,
  );
});

it('SHOULD answer 404 for a missing item or list', async () => {
  mocks.stock.findById.mockResolvedValueOnce(undefined);
  await expect(setup.execute({ ...base, itemId: 'gone', quantity: 1 })).rejects.toThrow(
    NotFoundException,
  );

  mocks.lists.findById.mockResolvedValueOnce(undefined);
  await expect(setup.execute({ ...base, itemId: 'item', quantity: 1 })).rejects.toThrow(
    NotFoundException,
  );
});

it('SHOULD refuse writing on a list of an archived family (422)', async () => {
  mocks.lists.findById.mockResolvedValueOnce(
    shoppingList('l', { owner: OwnerType.FAMILY, ownerId: 'family-id' }),
  );

  await expect(
    setup.execute({ ...base, accessibleOwners: mocks.archivedOwners, itemId: 'item', quantity: 1 }),
  ).rejects.toThrow(UnprocessableEntityException);
});

it('SHOULD reject an origin without restore, both shapes at once and neither', async () => {
  await expect(
    setup.execute({ ...base, itemId: 'item', origin: 'AUTO', quantity: 1 }),
  ).rejects.toThrow();
  await expect(
    setup.execute({
      ...base,
      description: 'x',
      itemId: 'item',
      quantity: 1,
      unit: StockUnits.UNIT,
    }),
  ).rejects.toThrow();
  await expect(setup.execute({ ...base, quantity: 1 })).rejects.toThrow();
});
