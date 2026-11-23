import { ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';

import { purchase } from '@stock/application/mocks/stock.mocks';
import { PurchaseStatuses } from '@stock/domain/entity/PurchaseEntity';

import {
  base,
  item,
  mocks,
  purchaseRow,
  rowId,
  setup,
  shoppingList,
  shoppingRow,
} from './index.mocks';

const text = { description: 'Candle', unit: 'unit' as never };

it('SHOULD store a typed unit price with the computed line total AND the typed input', async () => {
  await setup.execute({ ...base, ...text, quantity: 3, unitPriceCents: 250 });

  expect(mocks.purchases.upsertRow).toHaveBeenCalledWith(
    expect.objectContaining({
      lineTotalCents: 750,
      priceInput: 'UNIT',
      quantity: 3,
      unitPriceCents: 250,
    }),
  );
});

it('SHOULD compute the unit price from a typed line total', async () => {
  await setup.execute({ ...base, ...text, lineTotalCents: 900, quantity: 3 });

  expect(mocks.purchases.upsertRow).toHaveBeenCalledWith(
    expect.objectContaining({ lineTotalCents: 900, priceInput: 'LINE', unitPriceCents: 300 }),
  );
});

it('SHOULD keep the typed price WHEN only the quantity changes (FR 14)', async () => {
  mocks.purchases.findRows.mockResolvedValue([
    purchaseRow(base.rowId, {
      lineTotalCents: 600,
      priceInput: 'UNIT',
      quantity: 2,
      unitPriceCents: 300,
    }),
  ]);

  await setup.execute({ ...base, quantity: 4 });

  expect(mocks.purchases.upsertRow).toHaveBeenCalledWith(
    expect.objectContaining({ lineTotalCents: 1200, priceInput: 'UNIT', unitPriceCents: 300 }),
  );
});

it('SHOULD clear the price WHEN a null price is sent', async () => {
  await setup.execute({ ...base, unitPriceCents: null });

  expect(mocks.purchases.upsertRow).toHaveBeenCalledWith(
    expect.objectContaining({ lineTotalCents: null, unitPriceCents: null }),
  );
});

it('SHOULD read the unit from the item AND refuse a decimal quantity of a unit item (422)', async () => {
  mocks.stock.findById.mockResolvedValue(item());

  await expect(setup.execute({ ...base, itemId: 'item', quantity: 1.5 })).rejects.toThrow(
    UnprocessableEntityException,
  );
  expect(mocks.purchases.upsertRow).not.toHaveBeenCalled();
});

it('SHOULD answer 404 for an item of nobody the caller reaches AND 422 for another owner', async () => {
  mocks.stock.findById.mockResolvedValue(undefined);
  await expect(setup.execute({ ...base, itemId: 'item' })).rejects.toThrow(NotFoundException);

  mocks.stock.findById.mockResolvedValue(item());
  mocks.purchases.findById.mockResolvedValue(purchase('purchase-id', { listId: 'l' }));
  mocks.stock.findById.mockResolvedValue({ ...item(), owner: 'FAMILY', ownerId: 'family-id' });
  await expect(setup.execute({ ...base, itemId: 'item' })).rejects.toThrow(
    UnprocessableEntityException,
  );
});

it('SHOULD check the list row belongs to the list of the purchase', async () => {
  mocks.lists.findRowById.mockResolvedValue(shoppingRow('r1', shoppingList('other-list')));
  await expect(setup.execute({ ...base, listRowId: 'r1' })).rejects.toThrow(NotFoundException);

  mocks.lists.findRowById.mockResolvedValue(shoppingRow('r1', shoppingList('list-id')));
  await setup.execute({ ...base, listRowId: 'r1', quantity: 2 });
  expect(mocks.purchases.upsertRow).toHaveBeenCalledWith(
    expect.objectContaining({ listRowId: 'r1', quantity: 2 }),
  );
});

it('SHOULD return the conflict of a list row taken by another cart (FR 18)', async () => {
  mocks.purchases.upsertRow.mockResolvedValue({
    conflict: { purchaseId: 'p2', userName: 'Ana' },
    convertedToOutside: true,
    row: purchaseRow(rowId),
  });

  const result = await setup.execute({ ...base, ...text });

  expect(result.convertedToOutside).toBe(true);
  expect(result.conflict).toEqual({ purchaseId: 'p2', userName: 'Ana' });
});

it('SHOULD refuse (409) writes on an ended purchase AND while another member closes it', async () => {
  mocks.purchases.findById.mockResolvedValue(
    purchase('purchase-id', { status: PurchaseStatuses.ENDED }),
  );
  await expect(setup.execute({ ...base, ...text })).rejects.toThrow(ConflictException);

  mocks.purchases.findById.mockResolvedValue(
    purchase('purchase-id', { closingAt: new Date(), closingBy: 'other' }),
  );
  await expect(setup.execute({ ...base, ...text })).rejects.toThrow(ConflictException);
});
