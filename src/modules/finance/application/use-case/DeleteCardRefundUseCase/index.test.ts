import { NotFoundException } from '@nestjs/common';

import { mocks, setup } from './index.mocks';

it('SHOULD delete the refund', async () => {
  await setup.execute(mocks.input);

  expect(mocks.cardCreditRepository.deleteCredit).toHaveBeenCalledWith(mocks.refund.id);
});

it('SHOULD answer 404 WHEN the card or the refund is missing or does not match', async () => {
  mocks.creditCardRepository.findCreditCardById.mockResolvedValueOnce(undefined);
  await expect(setup.execute(mocks.input)).rejects.toThrow(NotFoundException);

  await expect(setup.execute({ ...mocks.input, accessibleOwners: [] })).rejects.toThrow(
    NotFoundException,
  );

  mocks.transactionRepository.findTransactionById.mockResolvedValueOnce({
    ...mocks.refund,
    category: { ...mocks.refund.category, systemKey: null },
  });
  await expect(setup.execute(mocks.input)).rejects.toThrow(NotFoundException);
  expect(mocks.cardCreditRepository.deleteCredit).not.toHaveBeenCalled();
});

it('SHOULD throw 422 "Family is archived" WHEN the owner is archived (spec 042)', async () => {
  const input = mocks.input;
  const accessibleOwners = input.accessibleOwners.map((access) => ({ ...access, archived: true }));

  await expect(setup.execute({ ...input, accessibleOwners })).rejects.toMatchObject({
    message: 'Family is archived',
    status: 422,
  });
});

it('SHOULD delete an imported discount WITHOUT a prepayment record, but not one that belongs to a prepayment (spec 048)', async () => {
  const discount = {
    ...mocks.refund,
    category: { ...mocks.refund.category, systemKey: 'INSTALLMENT_PREPAYMENT_DISCOUNT' },
  };

  mocks.transactionRepository.findTransactionById.mockResolvedValueOnce({
    ...discount,
    prepaymentId: null,
  });
  await setup.execute(mocks.input);
  expect(mocks.cardCreditRepository.deleteCredit).toHaveBeenCalledWith(mocks.refund.id);

  mocks.transactionRepository.findTransactionById.mockResolvedValueOnce({
    ...discount,
    prepaymentId: 'prepayment-1',
  });
  await expect(setup.execute(mocks.input)).rejects.toThrow(NotFoundException);
});
