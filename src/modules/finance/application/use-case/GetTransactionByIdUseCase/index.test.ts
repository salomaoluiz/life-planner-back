import { NotFoundException } from '@nestjs/common';

import { mocks, setup } from './index.mocks';

it('SHOULD return the transaction WHEN its owner is accessible', async () => {
  const result = await setup.execute({
    accessibleOwners: mocks.accessibleOwners,
    id: mocks.transaction.id,
  });

  expect(result).toBe(mocks.transaction);
  expect(mocks.transactionRepository.findTransactionById).toHaveBeenCalledWith(
    mocks.transaction.id,
  );
});

it.each([
  ['missing', undefined],
  ['owned by someone the caller cannot access', { ...mocks.transaction, ownerId: 'stranger' }],
])('SHOULD throw NotFound (404) WHEN the transaction is %s', async (_label, found) => {
  mocks.transactionRepository.findTransactionById.mockResolvedValueOnce(found);

  await expect(
    setup.execute({ accessibleOwners: mocks.accessibleOwners, id: mocks.transaction.id }),
  ).rejects.toThrow(NotFoundException);
});
