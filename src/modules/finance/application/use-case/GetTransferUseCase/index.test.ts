import { NotFoundException } from '@nestjs/common';

import { mocks, setup, spies } from './index.mocks';

it('SHOULD return the transfer WHEN the caller can read both sides', async () => {
  expect(await setup.execute({ accessibleOwners: mocks.accessibleOwners, id: mocks.transfer.id })).toBe(
    mocks.transfer,
  );
});

it('SHOULD throw NotFound WHEN the caller reads only one side', async () => {
  await expect(
    setup.execute({ accessibleOwners: [mocks.accessibleOwners[0]], id: mocks.transfer.id }),
  ).rejects.toThrow(NotFoundException);
});

it.each([
  ['missing', undefined],
  ['an account was removed', { ...mocks.transfer, toAccountId: null }],
])('SHOULD throw NotFound WHEN the transfer is %s', async (_label, found) => {
  spies.transferRepository.findTransferById.mockResolvedValueOnce(found);

  await expect(
    setup.execute({ accessibleOwners: mocks.accessibleOwners, id: mocks.transfer.id }),
  ).rejects.toThrow(NotFoundException);
});
