import { ConflictException, UnprocessableEntityException } from '@nestjs/common';

import { PurchaseStatuses } from '@stock/domain/entity/PurchaseEntity';

import { base, day, item, mocks, purchase, purchaseRow, rowA, rowB, setup } from './index.mocks';

it('SHOULD fill the single unpriced row with the difference AND post a split by finance category', async () => {
  const result = await setup.execute(base, mocks.postFinance);

  expect(mocks.postFinance).toHaveBeenCalledWith(
    expect.objectContaining({
      description: 'Compra no Atacadão',
      parts: [
        { categoryId: 'fin-default', kind: 'CATEGORY', valueCents: 400 },
        { categoryId: 'fin-food', kind: 'CATEGORY', valueCents: 600 },
      ],
      total: 1000,
    }),
  );
  expect(mocks.purchases.close).toHaveBeenCalledWith(
    expect.objectContaining({
      date: day('2026-11-18'),
      marketId: 'market-id',
      rows: [
        expect.objectContaining({ lineTotalCents: 600, rowId: rowA }),
        expect.objectContaining({ lineTotalCents: 400, rowId: rowB }),
      ],
    }),
    expect.any(Function),
  );
  expect(result.reference).toEqual({ splitId: 'split-1', transactionId: undefined });
  expect(result.lots).toBe(2);
});

it('SHOULD post the adjustment WHEN every row is priced (discount)', async () => {
  await setup.execute(
    { ...base, receiptTotalCents: 900, rows: [{ lineTotalCents: 400, rowId: rowB }] },
    mocks.postFinance,
  );

  expect(mocks.postFinance).toHaveBeenCalledWith(
    expect.objectContaining({
      parts: expect.arrayContaining([{ kind: 'ADJUSTMENT', valueCents: -100 }]),
    }),
  );
});

it('SHOULD answer 422 with the code WHEN the receipt leaves nothing for the unpriced row', async () => {
  await expect(
    setup.execute({ ...base, receiptTotalCents: 600 }, mocks.postFinance),
  ).rejects.toThrow(UnprocessableEntityException);
  expect(mocks.purchases.close).not.toHaveBeenCalled();
});

it('SHOULD ask the default finance category WHEN the list has none AND save the one chosen', async () => {
  mocks.lists.findById.mockResolvedValue({
    ...(await mocks.lists.findById.getMockImplementation()?.('x')),
    id: 'list-id',
  });
  const { shoppingList } = await import('@stock/application/mocks/stock.mocks');

  mocks.lists.findById.mockResolvedValue(shoppingList('list-id'));
  await expect(setup.execute(base, mocks.postFinance)).rejects.toMatchObject({
    response: { code: 'PURCHASE_DEFAULT_FINANCE_CATEGORY_REQUIRED' },
  });

  await setup.execute({ ...base, defaultFinanceCategoryId: 'fin-new' }, mocks.postFinance);
  expect(mocks.lists.update).toHaveBeenCalledWith({
    defaultFinanceCategoryId: 'fin-new',
    id: 'list-id',
  });
});

it('SHOULD require the quantity of kg and liter rows (422 with the row ids)', async () => {
  mocks.purchases.findRows.mockResolvedValue([
    purchaseRow(rowA, {
      item: { description: 'Beans', id: 'i1', unit: 'kilogram' as never },
      itemId: 'i1',
    }),
  ]);

  await expect(setup.execute(base, mocks.postFinance)).rejects.toMatchObject({
    response: { code: 'PURCHASE_WEIGHT_REQUIRED', rowIds: [rowA] },
  });
});

it('SHOULD use the item chosen for a text row (É este) AND refuse another owner', async () => {
  mocks.stock.findById.mockResolvedValue(item());
  await setup.execute({ ...base, rows: [{ itemId: 'item', rowId: rowB }] }, mocks.postFinance);
  expect(mocks.purchases.close).toHaveBeenCalledWith(
    expect.objectContaining({
      rows: expect.arrayContaining([expect.objectContaining({ itemId: 'item', rowId: rowB })]),
    }),
    expect.any(Function),
  );

  mocks.stock.findById.mockResolvedValue({ ...item(), owner: 'FAMILY', ownerId: 'family-id' });
  await expect(
    setup.execute({ ...base, rows: [{ itemId: 'item', rowId: rowB }] }, mocks.postFinance),
  ).rejects.toThrow(UnprocessableEntityException);
});

it('SHOULD refuse a row that is not in the purchase (422)', async () => {
  await expect(
    setup.execute(
      { ...base, rows: [{ rowId: '0d6f6f0e-6a62-4d77-8d8e-3d6f0b1a1cff' }] },
      mocks.postFinance,
    ),
  ).rejects.toThrow(UnprocessableEntityException);
});

it('SHOULD answer the stored result WHEN the same closer retries a purchase closed moments ago', async () => {
  mocks.purchases.findById.mockResolvedValue(
    purchase('purchase-id', {
      closedAt: new Date(),
      closedBy: 'user-id',
      splitId: 'split-1',
      status: PurchaseStatuses.CLOSED,
    }),
  );

  const result = await setup.execute(base, mocks.postFinance);

  expect(result.reference.splitId).toBe('split-1');
  expect(mocks.purchases.close).not.toHaveBeenCalled();
});

it('SHOULD answer 409 for a closed purchase of someone else AND for another closer lock', async () => {
  mocks.purchases.findById.mockResolvedValue(
    purchase('purchase-id', {
      closedAt: new Date(),
      closedBy: 'other',
      status: PurchaseStatuses.CLOSED,
    }),
  );
  await expect(setup.execute(base, mocks.postFinance)).rejects.toThrow(ConflictException);

  mocks.purchases.findById.mockResolvedValue(
    purchase('purchase-id', { closingAt: new Date(), closingBy: 'other' }),
  );
  await expect(setup.execute(base, mocks.postFinance)).rejects.toThrow(ConflictException);
});
