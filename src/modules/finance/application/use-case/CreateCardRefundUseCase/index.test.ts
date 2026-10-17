import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';

import { AccountStatus } from '@finance/domain/enum';

import { mocks, setup } from './index.mocks';

it('SHOULD create the refund on the chosen invoice with the link cap AND the card owner', async () => {
  const result = await setup.execute(mocks.input);

  expect(result).toEqual({ id: 'refund-1' });
  expect(mocks.cardCreditRepository.createRefund).toHaveBeenCalledWith({
    categoryId: '00000000-0000-4000-8000-000000000004',
    creditCardId: mocks.card.id,
    date: '2026-10-16',
    description: 'Refund · Notebook',
    invoiceMonth: '2026-10',
    maxLinked: 50000,
    owner: mocks.card.owner,
    ownerId: mocks.card.ownerId,
    refundedPlanId: undefined,
    refundedTransactionId: 'purchase-1',
    value: 20000,
  });
});

it('SHOULD create a standalone refund WITHOUT a cap', async () => {
  mocks.resolveLink.execute.mockResolvedValue({});

  await setup.execute({ ...mocks.input, refundedTransactionId: undefined });

  expect(mocks.cardCreditRepository.createRefund).toHaveBeenCalledWith(
    expect.objectContaining({ maxLinked: undefined }),
  );
});

it('SHOULD answer 422 WHEN the invoice is paid or upcoming', async () => {
  mocks.compute.execute.mockResolvedValue([
    { card: mocks.card, payments: [{ referenceMonth: '2026-10' }], totals: [] },
  ]);
  await expect(setup.execute(mocks.input)).rejects.toThrow(UnprocessableEntityException);

  mocks.compute.execute.mockResolvedValue([{ card: mocks.card, payments: [], totals: [] }]);
  await expect(setup.execute({ ...mocks.input, invoiceMonth: '2026-12' })).rejects.toThrow(
    'Invoice is paid or not open yet',
  );
  expect(mocks.cardCreditRepository.createRefund).not.toHaveBeenCalled();
});

it('SHOULD answer 422 WHEN the card is archived AND 404 WHEN it is missing or not accessible', async () => {
  mocks.creditCardRepository.findCreditCardById.mockResolvedValueOnce({
    ...mocks.card,
    status: AccountStatus.ARCHIVED,
  });
  await expect(setup.execute(mocks.input)).rejects.toThrow('archived');

  await expect(setup.execute({ ...mocks.input, accessibleOwners: [] })).rejects.toThrow(
    NotFoundException,
  );
  mocks.creditCardRepository.findCreditCardById.mockResolvedValueOnce(undefined);
  await expect(setup.execute(mocks.input)).rejects.toThrow(NotFoundException);
});

it('SHOULD reject a value below 1 cent', async () => {
  await expect(setup.execute({ ...mocks.input, value: 0 })).rejects.toThrow();
});
