import { NotFoundException } from '@nestjs/common';

import { mocks, setup } from './index.mocks';

it('SHOULD return the item WHEN its owner is accessible', async () => {
  expect(await setup.execute({ accessibleOwners: mocks.accessibleOwners, id: mocks.item.id })).toBe(
    mocks.item,
  );
});

it.each([
  ['missing', undefined],
  ['owned by someone else', { ...mocks.item, ownerId: 'someone-else' }],
])('SHOULD throw NotFound (404) WHEN the item is %s', async (_label, found) => {
  mocks.stockRepository.findById.mockResolvedValueOnce(found);

  await expect(
    setup.execute({ accessibleOwners: mocks.accessibleOwners, id: 'x' }),
  ).rejects.toThrow(NotFoundException);
});
