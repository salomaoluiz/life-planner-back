import { NotFoundException } from '@nestjs/common';

import { mocks, setup } from './index.mocks';

it('SHOULD delete an accessible transaction', async () => {
  await setup.execute({ accessibleOwners: mocks.accessibleOwners, id: mocks.transaction.id });

  expect(mocks.transactionRepository.deleteTransaction).toHaveBeenCalledWith(mocks.transaction.id);
});

it.each([
  ['missing', undefined],
  ['owned by someone the caller cannot access', { ...mocks.transaction, ownerId: 'stranger' }],
])(
  'SHOULD throw NotFound (404) AND delete nothing WHEN the transaction is %s',
  async (_label, found) => {
    mocks.transactionRepository.findTransactionById.mockResolvedValueOnce(found);

    await expect(
      setup.execute({ accessibleOwners: mocks.accessibleOwners, id: mocks.transaction.id }),
    ).rejects.toThrow(NotFoundException);
    expect(mocks.transactionRepository.deleteTransaction).not.toHaveBeenCalled();
  },
);
