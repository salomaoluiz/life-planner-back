import { NotFoundException } from '@nestjs/common';

import { mocks, setup } from './index.mocks';

it('SHOULD delete the payment', async () => {
  await setup.execute(mocks.input);

  expect(mocks.cardCreditRepository.deleteCredit).toHaveBeenCalledWith(mocks.payment.id);
});

it('SHOULD answer 404 WHEN the card or the payment is missing or does not match', async () => {
  mocks.creditCardRepository.findCreditCardById.mockResolvedValueOnce(undefined);
  await expect(setup.execute(mocks.input)).rejects.toThrow(NotFoundException);

  await expect(setup.execute({ ...mocks.input, accessibleOwners: [] })).rejects.toThrow(
    NotFoundException,
  );

  mocks.transactionRepository.findTransactionById.mockResolvedValueOnce({
    ...mocks.payment,
    category: { ...mocks.payment.category, systemKey: null },
  });
  await expect(setup.execute(mocks.input)).rejects.toThrow(NotFoundException);
  expect(mocks.cardCreditRepository.deleteCredit).not.toHaveBeenCalled();
});
