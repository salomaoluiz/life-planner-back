import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';

import { mocks, setup } from './index.mocks';

it('SHOULD re-check the link cap WHEN the value changes', async () => {
  await setup.execute({ ...mocks.input, value: 25000 });

  expect(mocks.resolveLink.execute).toHaveBeenCalledWith({
    creditCardId: mocks.card.id,
    refundedPlanId: null,
    refundedTransactionId: 'purchase-1',
  });
  expect(mocks.cardCreditRepository.updateRefund).toHaveBeenCalledWith(
    expect.objectContaining({ id: mocks.refund.id, maxLinked: 50000, value: 25000 }),
  );
});

it('SHOULD change only the description WITHOUT resolving a link', async () => {
  await setup.execute({ ...mocks.input, description: 'Renamed' });

  expect(mocks.resolveLink.execute).not.toHaveBeenCalled();
  expect(mocks.cardCreditRepository.updateRefund).toHaveBeenCalledWith(
    expect.objectContaining({ description: 'Renamed', maxLinked: undefined }),
  );
});

it('SHOULD remove the link WITHOUT a cap WHEN null is sent', async () => {
  mocks.resolveLink.execute.mockResolvedValue({});

  await setup.execute({ ...mocks.input, refundedTransactionId: null });

  expect(mocks.cardCreditRepository.updateRefund).toHaveBeenCalledWith(
    expect.objectContaining({ maxLinked: undefined, refundedTransactionId: null }),
  );
});

describe('paid invoice', () => {
  beforeEach(() =>
    mocks.compute.execute.mockResolvedValue([
      { card: mocks.card, payments: [{ referenceMonth: '2026-10' }], totals: [] },
    ]),
  );

  it('SHOULD allow only the description', async () => {
    await setup.execute({ ...mocks.input, description: 'Renamed' });

    expect(mocks.cardCreditRepository.updateRefund).toHaveBeenCalledTimes(1);
  });

  it('SHOULD answer 422 for any other change', async () => {
    await expect(setup.execute({ ...mocks.input, value: 1 })).rejects.toThrow(
      UnprocessableEntityException,
    );
    expect(mocks.cardCreditRepository.updateRefund).not.toHaveBeenCalled();
  });
});

it('SHOULD answer 422 WHEN moved to an upcoming invoice', async () => {
  await expect(setup.execute({ ...mocks.input, invoiceMonth: '2026-12' })).rejects.toThrow(
    'Invoice is paid or not open yet',
  );
});

it('SHOULD answer 404 WHEN the refund is missing, of another card or not a refund', async () => {
  mocks.transactionRepository.findTransactionById.mockResolvedValueOnce(undefined);
  await expect(setup.execute(mocks.input)).rejects.toThrow(NotFoundException);

  mocks.transactionRepository.findTransactionById.mockResolvedValueOnce({
    ...mocks.refund,
    creditCardId: 'other',
  });
  await expect(setup.execute(mocks.input)).rejects.toThrow(NotFoundException);

  mocks.transactionRepository.findTransactionById.mockResolvedValueOnce({
    ...mocks.refund,
    category: { ...mocks.refund.category, systemKey: null },
  });
  await expect(setup.execute(mocks.input)).rejects.toThrow(NotFoundException);

  await expect(setup.execute({ ...mocks.input, accessibleOwners: [] })).rejects.toThrow(
    NotFoundException,
  );
});
