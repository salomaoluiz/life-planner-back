import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';

import { StockUnits } from '@stock/domain/entity/StockEntity';

import { list, mocks, setup, shoppingList, shoppingRow } from './index.mocks';

const ids = { accessibleOwners: mocks.accessibleOwners, id: 'r' };

it('SHOULD update the quantity and the typed price of an item row', async () => {
  const view = await setup.execute({ ...ids, estimatedUnitPriceCents: 489, quantity: 3 });

  expect(mocks.lists.updateRow).toHaveBeenCalledWith({
    description: undefined,
    estimatedUnitPriceCents: 489,
    id: 'r',
    quantity: 3,
    unit: undefined,
  });
  expect(view.quantity).toBe(3);
});

it('SHOULD refuse a description or unit on an item row AND a bad quantity precision (422)', async () => {
  await expect(setup.execute({ ...ids, description: 'x' })).rejects.toThrow(
    UnprocessableEntityException,
  );
  await expect(setup.execute({ ...ids, quantity: 1.5 })).rejects.toThrow(
    UnprocessableEntityException,
  );
});

it('SHOULD edit the text, unit and quantity of a text row AND accept clearing the price', async () => {
  mocks.lists.findRowById.mockResolvedValue(shoppingRow('r', list, { description: 'Candle' }));

  await setup.execute({
    ...ids,
    description: 'Big candle',
    estimatedUnitPriceCents: null,
    quantity: 2,
    unit: StockUnits.UNIT,
  });

  expect(mocks.lists.updateRow).toHaveBeenCalledWith(
    expect.objectContaining({ description: 'Big candle', estimatedUnitPriceCents: null }),
  );
});

it('SHOULD answer 404 for an unreachable row AND 422 WHEN the family is archived', async () => {
  mocks.lists.findRowById.mockResolvedValueOnce(undefined);
  await expect(setup.execute({ ...ids, quantity: 1 })).rejects.toThrow(NotFoundException);

  mocks.lists.findRowById.mockResolvedValue(
    shoppingRow('r', shoppingList('f', { owner: 'FAMILY' as never, ownerId: 'family-id' }), {
      description: 'Candle',
    }),
  );
  await expect(
    setup.execute({ accessibleOwners: mocks.archivedOwners, id: 'r', quantity: 1 }),
  ).rejects.toThrow(UnprocessableEntityException);
});

it('SHOULD require at least one field', async () => {
  await expect(setup.execute(ids)).rejects.toThrow();
});
