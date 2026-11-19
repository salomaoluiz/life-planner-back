import { NotFoundException } from '@nestjs/common';

import { mocks, setup, spies } from './index.mocks';

it('SHOULD return the split WHEN the caller can read its owner', async () => {
  expect(
    await setup.execute({ accessibleOwners: mocks.accessibleOwners, id: mocks.split.id }),
  ).toBe(mocks.split);
});

it('SHOULD throw NotFound WHEN the caller can not read the owner', async () => {
  await expect(setup.execute({ accessibleOwners: [], id: mocks.split.id })).rejects.toThrow(
    NotFoundException,
  );
});

it('SHOULD throw NotFound WHEN the split does not exist', async () => {
  spies.splitRepository.findSplitById.mockResolvedValueOnce(undefined);

  await expect(
    setup.execute({ accessibleOwners: mocks.accessibleOwners, id: 'missing' }),
  ).rejects.toThrow(NotFoundException);
});
