import { UnprocessableEntityException } from '@nestjs/common';

import { mocks, setup, spies } from './index.mocks';

it('SHOULD delete the split with every part', async () => {
  await setup.execute({ accessibleOwners: mocks.accessibleOwners, id: mocks.split.id });

  expect(spies.splitRepository.deleteSplit).toHaveBeenCalledWith(mocks.split.id);
});

it('SHOULD refuse WHEN the owner is an archived family (422) AND not delete', async () => {
  await expect(
    setup.execute({
      accessibleOwners: [{ ...mocks.accessibleOwners[0], archived: true }],
      id: mocks.split.id,
    }),
  ).rejects.toThrow(UnprocessableEntityException);
  expect(spies.splitRepository.deleteSplit).not.toHaveBeenCalled();
});
