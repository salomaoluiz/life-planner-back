import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';

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

it('SHOULD refuse to delete the INVOICE_PAYMENT transaction (422): only undoing the payment removes it', async () => {
  mocks.transactionRepository.findTransactionById.mockResolvedValueOnce({
    ...mocks.transaction,
    category: { ...mocks.transaction.category, systemKey: 'INVOICE_PAYMENT' },
  });

  await expect(
    setup.execute({ accessibleOwners: mocks.accessibleOwners, id: mocks.transaction.id }),
  ).rejects.toThrow(UnprocessableEntityException);
  expect(mocks.transactionRepository.deleteTransaction).not.toHaveBeenCalled();
});

it('SHOULD refuse to delete one installment (422): the whole plan goes through its own endpoint', async () => {
  mocks.transactionRepository.findTransactionById.mockResolvedValueOnce({
    ...mocks.transaction,
    installmentPlanId: 'plan-1',
  });

  await expect(
    setup.execute({ accessibleOwners: mocks.accessibleOwners, id: mocks.transaction.id }),
  ).rejects.toThrow('Delete the installment plan');
  expect(mocks.transactionRepository.deleteTransaction).not.toHaveBeenCalled();
});
