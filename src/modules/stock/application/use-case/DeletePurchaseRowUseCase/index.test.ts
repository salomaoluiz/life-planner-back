import { ConflictException } from '@nestjs/common';

import { purchase } from '@stock/application/mocks/stock.mocks';
import { PurchaseStatuses } from '@stock/domain/entity/PurchaseEntity';

import { base, mocks, setup } from './index.mocks';

it('SHOULD delete the row of an open purchase', async () => {
  await setup.execute(base);

  expect(mocks.purchases.deleteRow).toHaveBeenCalledWith({
    clientId: undefined,
    purchaseId: 'purchase-id',
    rowId: base.rowId,
    userId: 'user-id',
  });
});

it('SHOULD refuse (409) WHEN the purchase is not open', async () => {
  mocks.purchases.findById.mockResolvedValue(
    purchase('purchase-id', { status: PurchaseStatuses.CLOSED }),
  );

  await expect(setup.execute(base)).rejects.toThrow(ConflictException);
  expect(mocks.purchases.deleteRow).not.toHaveBeenCalled();
});
