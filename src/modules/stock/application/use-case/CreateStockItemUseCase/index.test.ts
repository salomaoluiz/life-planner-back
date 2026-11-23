import { ForbiddenException, UnprocessableEntityException } from '@nestjs/common';

import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import { ValidationError } from '@shared/domain/error/ValidationError';
import {
  archivedOwners,
  category,
  item,
  location,
  shoppingList,
} from '@stock/application/mocks/stock.mocks';
import { StockCatalogStatus } from '@stock/domain/entity/StockCategoryEntity';
import { StockUnits } from '@stock/domain/entity/StockEntity';

import { base, mocks, setup } from './index.mocks';

it('SHOULD create the item with its first lot (purchase date defaults to today) AND return the view', async () => {
  const view = await setup.execute({
    ...base,
    expirationDate: '2026-11-20',
    quantity: 2,
    today: '2026-11-10',
  });

  expect(mocks.stock.create).toHaveBeenCalledWith(
    expect.objectContaining({
      firstLot: {
        expirationDate: new Date('2026-11-20T00:00:00.000Z'),
        purchaseDate: new Date('2026-11-10T00:00:00.000Z'),
        quantity: 2,
      },
      stockOnly: false,
      userId: 'user-id',
      warnDaysClosed: 7,
      warnDaysOpened: 1,
    }),
  );
  expect(view.quantity).toBe(2);
});

it('SHOULD create the item with no lot WHEN the quantity is 0', async () => {
  await setup.execute(base);

  expect(mocks.stock.create).toHaveBeenCalledWith(expect.objectContaining({ firstLot: undefined }));
});

it('SHOULD refresh the embedding AFTER the write without waiting for it', async () => {
  mocks.refresh.execute.mockRejectedValue(new Error('provider down'));

  await expect(setup.execute(base)).resolves.toBeDefined();
  expect(mocks.refresh.execute).toHaveBeenCalledWith({ id: 'item' });
});

it('SHOULD check the category and location against the owner', async () => {
  mocks.catalog.findCategoryById.mockResolvedValue(category('c'));
  mocks.catalog.findLocationById.mockResolvedValue(location('l'));

  await setup.execute({ ...base, categoryId: 'c', locationId: 'l' });

  expect(mocks.stock.create).toHaveBeenCalledWith(
    expect.objectContaining({ categoryId: 'c', locationId: 'l' }),
  );
});

it.each([
  ['a decimal quantity on a UNIT item', { quantity: 1.5 }],
  ['an ideal not above the minimum', { idealQuantity: 1, minQuantity: 2 }],
  ['a minimum on a stock-only item', { minQuantity: 1, stockOnly: true }],
  ['a category the owner does not have', { categoryId: 'missing' }],
])('SHOULD refuse %s with 422 AND write nothing', async (_label, extra) => {
  await expect(setup.execute({ ...base, ...extra })).rejects.toThrow(UnprocessableEntityException);
  expect(mocks.stock.create).not.toHaveBeenCalled();
});

it('SHOULD accept 3 decimals on kg items and refuse 4', async () => {
  await expect(
    setup.execute({ ...base, quantity: 1.5, unit: StockUnits.KILOGRAM }),
  ).resolves.toBeDefined();
  await expect(
    setup.execute({ ...base, quantity: 1.5555, unit: StockUnits.KILOGRAM }),
  ).rejects.toThrow(UnprocessableEntityException);
});

it('SHOULD refuse an owner the caller cannot access (403) and an archived family (422)', async () => {
  await expect(setup.execute({ ...base, ownerId: 'other' })).rejects.toThrow(ForbiddenException);
  await expect(
    setup.execute({
      ...base,
      accessibleOwners: archivedOwners,
      owner: OwnerType.FAMILY,
      ownerId: 'family-id',
    }),
  ).rejects.toThrow(UnprocessableEntityException);
});

it('SHOULD throw ValidationError WHEN the input is malformed', async () => {
  await expect(setup.execute({ ...base, quantity: -1 })).rejects.toThrow(ValidationError);
  await expect(setup.execute({ ...base, description: '' })).rejects.toThrow(ValidationError);
});

describe('shopping list (spec 118)', () => {
  it('SHOULD store the list and the typed price WHEN the list is an active one of the same owner', async () => {
    mocks.lists.findById.mockResolvedValue(shoppingList('l'));

    await setup.execute({ ...base, estimatedUnitPriceCents: 489, shoppingListId: 'l' });

    expect(mocks.stock.create).toHaveBeenCalledWith(
      expect.objectContaining({ estimatedUnitPriceCents: 489, shoppingListId: 'l' }),
    );
  });

  it('SHOULD refuse a missing, archived or foreign list AND a list on a stock-only item (422)', async () => {
    mocks.lists.findById.mockResolvedValueOnce(undefined);
    await expect(setup.execute({ ...base, shoppingListId: 'l' })).rejects.toThrow(
      UnprocessableEntityException,
    );

    mocks.lists.findById.mockResolvedValueOnce(
      shoppingList('l', { status: StockCatalogStatus.ARCHIVED }),
    );
    await expect(setup.execute({ ...base, shoppingListId: 'l' })).rejects.toThrow(
      UnprocessableEntityException,
    );

    mocks.lists.findById.mockResolvedValueOnce(shoppingList('l', { ownerId: 'someone-else' }));
    await expect(setup.execute({ ...base, shoppingListId: 'l' })).rejects.toThrow(
      UnprocessableEntityException,
    );

    await expect(setup.execute({ ...base, shoppingListId: 'l', stockOnly: true })).rejects.toThrow(
      UnprocessableEntityException,
    );
    expect(mocks.stock.create).not.toHaveBeenCalled();
  });
});

describe('barcode (spec 121)', () => {
  it('SHOULD store the normalized code', async () => {
    mocks.stock.findByOwners.mockResolvedValue([]);

    await setup.execute({ ...base, barcode: ' 036000291452 ' });

    expect(mocks.stock.create).toHaveBeenCalledWith(
      expect.objectContaining({ barcode: '0036000291452' }),
    );
  });

  it('SHOULD refuse a wrong check digit with 422 AND write nothing', async () => {
    await expect(setup.execute({ ...base, barcode: '7891000100104' })).rejects.toThrow(
      UnprocessableEntityException,
    );
    expect(mocks.stock.create).not.toHaveBeenCalled();
  });

  it('SHOULD answer 409 BARCODE_IN_USE WHEN another item of the owner has the code', async () => {
    mocks.stock.findByOwners.mockResolvedValue([
      item([], (f) => f.withDescription('Leite').withId('other')),
    ]);

    await expect(setup.execute({ ...base, barcode: '7891000100103' })).rejects.toMatchObject({
      response: { code: 'BARCODE_IN_USE', itemId: 'other' },
    });
    expect(mocks.stock.create).not.toHaveBeenCalled();
  });
});
