import { ConflictException, UnprocessableEntityException } from '@nestjs/common';

import { purchase } from '@stock/application/mocks/stock.mocks';
import { PurchaseStatuses } from '@stock/domain/entity/PurchaseEntity';

import { base, mocks, setup } from './index.mocks';

it('SHOULD merge the source into the target', async () => {
  await setup.execute(base);

  expect(mocks.purchases.mergeInto).toHaveBeenCalledWith('a', 'b', 'user-id');
});

it('SHOULD refuse (422) the same purchase AND another list', async () => {
  await expect(setup.execute({ ...base, targetId: 'a' })).rejects.toThrow(
    UnprocessableEntityException,
  );

  mocks.purchases.findById.mockImplementation(async (id: string) =>
    purchase(id, { listId: id === 'a' ? 'l1' : 'l2' }),
  );
  await expect(setup.execute(base)).rejects.toThrow(UnprocessableEntityException);
});

it('SHOULD refuse (409) a closed purchase', async () => {
  mocks.purchases.findById.mockImplementation(async (id: string) =>
    purchase(id, { status: id === 'a' ? PurchaseStatuses.CLOSED : PurchaseStatuses.OPEN }),
  );

  await expect(setup.execute(base)).rejects.toThrow(ConflictException);
});
