import { NotFoundException } from '@nestjs/common';

import { mocks, setup } from './index.mocks';

it('SHOULD build the view of the purchase', async () => {
  const view = await setup.execute({ accessibleOwners: mocks.accessibleOwners, id: 'p' });

  expect(view.purchase.id).toBe('p');
  expect(view.cart).toEqual({ count: 0, totalCents: 0, unpricedCount: 0 });
});

it('SHOULD answer 404 for a purchase the caller cannot read', async () => {
  mocks.purchases.findById.mockResolvedValue(undefined);

  await expect(
    setup.execute({ accessibleOwners: mocks.accessibleOwners, id: 'p' }),
  ).rejects.toThrow(NotFoundException);
});
