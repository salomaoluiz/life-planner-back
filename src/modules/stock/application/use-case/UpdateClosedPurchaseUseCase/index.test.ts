import { ConflictException } from '@nestjs/common';

import { base, mocks, purchase, setup } from './index.mocks';

it('SHOULD rebuild the posting with the edited prices AND the stored source', async () => {
  await setup.execute(
    {
      ...base,
      receiptTotalCents: 900,
      rows: [{ lineTotalCents: 900, rowId: '0d6f6f0e-6a62-4d77-8d8e-3d6f0b1a1c11' }],
    },
    mocks.repost,
  );

  expect(mocks.purchases.updateClosed).toHaveBeenCalledWith(
    expect.objectContaining({
      accountId: 'account-id',
      purchaseId: 'purchase-id',
      receiptTotalCents: 900,
    }),
    expect.any(Function),
  );
  expect(mocks.repost).toHaveBeenCalledWith(
    expect.objectContaining({
      accountId: 'account-id',
      parts: [
        { categoryId: 'fin', kind: 'CATEGORY', valueCents: 1000 },
        { kind: 'ADJUSTMENT', valueCents: -100 },
      ],
      splitId: 'split-1',
      total: 900,
    }),
  );
});

it('SHOULD switch the source WHEN a card is sent', async () => {
  await setup.execute({ ...base, creditCardId: 'card-id', invoiceMonth: '2026-12' }, mocks.repost);

  expect(mocks.purchases.updateClosed).toHaveBeenCalledWith(
    expect.objectContaining({
      accountId: undefined,
      creditCardId: 'card-id',
      invoiceMonth: '2026-12',
    }),
    expect.any(Function),
  );
});

it('SHOULD refuse (409) a purchase that is not closed', async () => {
  mocks.purchases.findById.mockResolvedValue(purchase('purchase-id'));

  await expect(setup.execute(base, mocks.repost)).rejects.toThrow(ConflictException);
  expect(mocks.purchases.updateClosed).not.toHaveBeenCalled();
});
