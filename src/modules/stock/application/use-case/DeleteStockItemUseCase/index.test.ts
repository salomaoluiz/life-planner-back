import { NotFoundException } from '@nestjs/common';

import { mocks, setup } from './index.mocks';

it('SHOULD delete an accessible item', async () => {
  await setup.execute({ accessibleOwners: mocks.accessibleOwners, id: mocks.item.id });

  expect(mocks.stockRepository.delete).toHaveBeenCalledWith(mocks.item.id);
});

it.each([
  ['missing (also a second delete of the same id)', undefined],
  ['inaccessible', { ...mocks.item, ownerId: 'someone-else' }],
])('SHOULD throw NotFound (404) AND delete nothing WHEN the item is %s', async (_label, found) => {
  mocks.stockRepository.findById.mockResolvedValueOnce(found);

  await expect(
    setup.execute({ accessibleOwners: mocks.accessibleOwners, id: 'x' }),
  ).rejects.toThrow(NotFoundException);
  expect(mocks.stockRepository.delete).not.toHaveBeenCalled();
});
