import { BadRequestException } from '@nestjs/common';

import { item } from '@stock/application/mocks/stock.mocks';
import { StockUnits } from '@stock/domain/entity/StockEntity';

import { base, mocks, rowId, setup } from './index.mocks';

it('SHOULD add the owner’s item WITHOUT asking Open Food Facts', async () => {
  mocks.stock.findByOwners.mockResolvedValue([item([], (f) => f.withId('item-1'))]);

  const result = await setup.execute(base);

  expect(result.source).toBe('ITEM');
  expect(mocks.stock.findByOwners).toHaveBeenCalledWith(
    [expect.objectContaining({ ownerId: 'user-id' })],
    { barcode: '7891000100103' },
  );
  expect(mocks.purchases.upsertRow).toHaveBeenCalledWith(
    expect.objectContaining({ itemId: 'item-1', quantity: 1, rowId }),
  );
  expect(mocks.off.getProduct).not.toHaveBeenCalled();
});

it('SHOULD create a named outside-the-list row from Open Food Facts WITH the code', async () => {
  mocks.off.getProduct.mockResolvedValue({ brands: 'Marca', name: 'Café', quantity: '500 g' });

  const result = await setup.execute(base);

  expect(result.source).toBe('OPEN_FOOD_FACTS');
  expect(mocks.purchases.upsertRow).toHaveBeenCalledWith(
    expect.objectContaining({
      barcode: '7891000100103',
      description: 'Café',
      quantity: undefined,
      unit: StockUnits.KILOGRAM,
    }),
  );
});

it('SHOULD create a placeholder row WHEN nobody knows the code', async () => {
  const result = await setup.execute(base);

  expect(result.source).toBe('NONE');
  expect(mocks.purchases.upsertRow).toHaveBeenCalledWith(
    expect.objectContaining({
      barcode: '7891000100103',
      description: 'Produto 7891000100103',
      quantity: 1,
      unit: StockUnits.UNIT,
    }),
  );
});

it('SHOULD generate the row id WHEN the client sends none', async () => {
  await setup.execute({ ...base, rowId: undefined });

  expect(mocks.purchases.upsertRow.mock.calls[0][0].rowId).toMatch(/^[0-9a-f-]{36}$/);
});

it('SHOULD answer 400 for a wrong check digit WITHOUT writing', async () => {
  await expect(setup.execute({ ...base, code: '7891000100104' })).rejects.toThrow(
    BadRequestException,
  );
  expect(mocks.purchases.upsertRow).not.toHaveBeenCalled();
});
