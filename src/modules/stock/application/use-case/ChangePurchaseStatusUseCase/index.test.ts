import { ConflictException, NotFoundException } from '@nestjs/common';

import { purchase } from '@stock/application/mocks/stock.mocks';
import { PurchaseStatuses } from '@stock/domain/entity/PurchaseEntity';

import { base, mocks, setup } from './index.mocks';

it('SHOULD end an open purchase AND reopen an ended one', async () => {
  await setup.execute({ ...base, action: 'END', clientId: '0d6f6f0e-6a62-4d77-8d8e-3d6f0b1a1c11' });
  expect(mocks.purchases.transition).toHaveBeenCalledWith(
    'purchase-id',
    PurchaseStatuses.ENDED,
    'user-id',
    '0d6f6f0e-6a62-4d77-8d8e-3d6f0b1a1c11',
  );

  mocks.purchases.findById.mockResolvedValue(
    purchase('purchase-id', { status: PurchaseStatuses.ENDED }),
  );
  await setup.execute({ ...base, action: 'REOPEN' });
  expect(mocks.purchases.transition).toHaveBeenLastCalledWith(
    'purchase-id',
    PurchaseStatuses.OPEN,
    'user-id',
    undefined,
  );
});

it('SHOULD discard from open or ended AND refuse (409) from closed or discarded', async () => {
  await setup.execute({ ...base, action: 'DISCARD' });
  expect(mocks.purchases.transition).toHaveBeenCalledWith(
    'purchase-id',
    PurchaseStatuses.DISCARDED,
    'user-id',
    undefined,
  );

  mocks.purchases.findById.mockResolvedValue(
    purchase('purchase-id', { status: PurchaseStatuses.CLOSED }),
  );
  await expect(setup.execute({ ...base, action: 'DISCARD' })).rejects.toThrow(ConflictException);
  await expect(setup.execute({ ...base, action: 'END' })).rejects.toThrow(ConflictException);
});

it('SHOULD answer 409 PURCHASE_CLOSING WHEN another member holds a valid closing lock', async () => {
  mocks.purchases.findById.mockResolvedValue(
    purchase('purchase-id', { closingAt: new Date(), closingBy: 'someone-else' }),
  );

  await expect(setup.execute({ ...base, action: 'END' })).rejects.toThrow(ConflictException);
  expect(mocks.purchases.transition).not.toHaveBeenCalled();
});

it('SHOULD answer 404 WHEN the purchase is missing or of an unreachable owner', async () => {
  mocks.purchases.findById.mockResolvedValue(undefined);
  await expect(setup.execute({ ...base, action: 'END' })).rejects.toThrow(NotFoundException);
  mocks.purchases.findById.mockResolvedValue(purchase('purchase-id', { ownerId: 'stranger' }));
  await expect(setup.execute({ ...base, action: 'END' })).rejects.toThrow(NotFoundException);
});
