import { NotFoundException } from '@nestjs/common';

import { base, mocks, setup } from './index.mocks';

it('SHOULD delete through the repository handing the finance cancel along', async () => {
  const result = await setup.execute(base, mocks.cancel);

  expect(result).toEqual({ kept: [] });
  expect(mocks.purchases.deleteClosed).toHaveBeenCalledWith('purchase-id', 'user-id', mocks.cancel);
});

it('SHOULD answer 404 for a purchase the caller cannot reach', async () => {
  mocks.purchases.findById.mockResolvedValue(undefined);

  await expect(setup.execute(base, mocks.cancel)).rejects.toThrow(NotFoundException);
});
