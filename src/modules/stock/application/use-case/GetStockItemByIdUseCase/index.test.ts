import { NotFoundException } from '@nestjs/common';

import { ValidationError } from '@shared/domain/error/ValidationError';
import { item } from '@stock/application/mocks/stock.mocks';

import { mocks, setup } from './index.mocks';

it('SHOULD return the item view with its lots', async () => {
  const view = await setup.execute({ accessibleOwners: mocks.accessibleOwners, id: 'item' });

  expect(view.quantity).toBe(2);
  expect(view.lots).toHaveLength(1);
  expect(mocks.stock.findById).toHaveBeenCalledWith('item');
});

it.each([
  ['missing', undefined],
  ['of another owner', item([], (f) => f.withOwnerId('other'))],
])('SHOULD answer 404 WHEN the item is %s', async (_label, found) => {
  mocks.stock.findById.mockResolvedValue(found);

  await expect(
    setup.execute({ accessibleOwners: mocks.accessibleOwners, id: 'item' }),
  ).rejects.toThrow(NotFoundException);
});

it('SHOULD throw ValidationError WHEN the id is empty', async () => {
  await expect(setup.execute({ accessibleOwners: mocks.accessibleOwners, id: '' })).rejects.toThrow(
    ValidationError,
  );
});
