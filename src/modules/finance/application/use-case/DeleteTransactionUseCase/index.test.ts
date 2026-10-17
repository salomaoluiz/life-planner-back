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

it.each(['CARD_REFUND', 'CARD_EARLY_PAYMENT', 'INSTALLMENT_PREPAYMENT_DISCOUNT'])(
  'SHOULD refuse to delete a %s row here (422): the card endpoints own it',
  async (systemKey) => {
    mocks.transactionRepository.findTransactionById.mockResolvedValueOnce({
      ...mocks.transaction,
      category: { ...mocks.transaction.category, systemKey },
    });

    await expect(
      setup.execute({ accessibleOwners: mocks.accessibleOwners, id: mocks.transaction.id }),
    ).rejects.toThrow('Use the card to change this credit');
    expect(mocks.transactionRepository.deleteTransaction).not.toHaveBeenCalled();
  },
);

it('SHOULD refuse to delete a purchase that has refunds (422)', async () => {
  mocks.cardCreditRepository.countRefundsByTransactionId.mockResolvedValueOnce(1);

  await expect(
    setup.execute({ accessibleOwners: mocks.accessibleOwners, id: mocks.transaction.id }),
  ).rejects.toThrow('Delete its refunds first');
  expect(mocks.transactionRepository.deleteTransaction).not.toHaveBeenCalled();
});
