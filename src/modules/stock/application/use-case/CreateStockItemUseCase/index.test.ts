import { ForbiddenException, UnprocessableEntityException } from '@nestjs/common';

import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import { ValidationError } from '@shared/domain/error/ValidationError';
import { archivedOwners, category, location } from '@stock/application/mocks/stock.mocks';
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
