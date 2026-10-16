import { NotFoundException } from '@nestjs/common';

import { mocks, setup } from './index.mocks';

it('SHOULD return the card, the invoice and its purchases', async () => {
  const result = await setup.execute(mocks.input);

  expect(result.card).toBe(mocks.card);
  expect(result.invoice).toMatchObject({
    amount: 45000,
    referenceMonth: '2026-10',
    status: 'CLOSED',
  });
  expect(result.purchases).toEqual([mocks.purchase]);
  expect(result.credits).toEqual([mocks.refund]);
  expect(mocks.transactionRepository.findCardPurchases).toHaveBeenCalledWith([
    { creditCardId: mocks.card.id, invoiceMonth: '2026-10' },
  ]);
});

it('SHOULD return an empty invoice for a month without purchases', async () => {
  mocks.transactionRepository.findCardPurchases.mockResolvedValueOnce([]);

  const result = await setup.execute({ ...mocks.input, invoiceMonth: '2027-03' });

  expect(result.invoice.amount).toBe(0);
  expect(result.purchases).toEqual([]);
});

it.each([
  ['missing', undefined],
  ['not accessible', { ...mocks.card, ownerId: 'stranger' }],
])('SHOULD throw NotFound (404) WHEN the card is %s', async (_label, found) => {
  mocks.creditCardRepository.findCreditCardById.mockResolvedValueOnce(found);

  await expect(setup.execute(mocks.input)).rejects.toThrow(NotFoundException);
});
