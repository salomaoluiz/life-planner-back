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

describe('recurring occurrences (spec 034)', () => {
  const owners = [{ owner: mocks.recurring.owner, ownerId: mocks.recurring.ownerId }];
  async function run(scope?: string) {
    return setup.execute({ accessibleOwners: owners, id: mocks.recurring.id, scope } as never);
  }

  beforeEach(() => {
    mocks.transactionRepository.findTransactionById.mockResolvedValue(mocks.recurring);
  });

  it('SHOULD delete only that row with scope ONLY_THIS AND not hide numbers the series already generated', async () => {
    await run('ONLY_THIS');

    expect(mocks.transactionRepository.deleteTransaction).toHaveBeenCalledWith(mocks.recurring.id);
    expect(mocks.recurrenceRepository.skipNumber).not.toHaveBeenCalled();
  });

  it('SHOULD hide the number WHEN the row was a projected occurrence made real', async () => {
    mocks.transactionRepository.findTransactionById.mockResolvedValue({
      ...mocks.recurring,
      occurrenceNumber: 9,
    });

    await run('ONLY_THIS');

    expect(mocks.recurrenceRepository.skipNumber).toHaveBeenCalledWith('series-1', 9);
  });

  it('SHOULD not fail WHEN the series is gone', async () => {
    mocks.recurrenceRepository.findById.mockResolvedValue(undefined);

    await run('ONLY_THIS');

    expect(mocks.recurrenceRepository.skipNumber).not.toHaveBeenCalled();
  });

  it('SHOULD answer 422 "Choose the delete scope" WHEN there is no scope AND delete nothing', async () => {
    await expect(run()).rejects.toThrow('Choose the delete scope');
    expect(mocks.transactionRepository.deleteTransaction).not.toHaveBeenCalled();
  });

  it('SHOULD answer 422 WHEN the scope reaches more than one occurrence', async () => {
    await expect(run('THIS_AND_NEXT')).rejects.toThrow(
      'Use the recurrence to delete more occurrences',
    );
  });

  it('SHOULD keep the refunds rule on a recurring card purchase', async () => {
    mocks.cardCreditRepository.countRefundsByTransactionId.mockResolvedValue(1);

    await expect(run('ONLY_THIS')).rejects.toThrow('Delete its refunds first');
  });
});

it('SHOULD throw 422 "Family is archived" WHEN the owner is archived (spec 042)', async () => {
  const input = { accessibleOwners: mocks.accessibleOwners, id: mocks.transaction.id };
  const accessibleOwners = input.accessibleOwners.map((access) => ({ ...access, archived: true }));

  await expect(setup.execute({ ...input, accessibleOwners })).rejects.toMatchObject({
    message: 'Family is archived',
    status: 422,
  });
});
