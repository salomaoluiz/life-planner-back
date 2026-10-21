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

it('SHOULD throw 422 "Family is archived" WHEN the owner is archived (spec 042)', async () => {
  const input = { ...mocks.input, value: 25000 };
  const accessibleOwners = input.accessibleOwners.map((access) => ({ ...access, archived: true }));

  await expect(setup.execute({ ...input, accessibleOwners })).rejects.toMatchObject({
    message: 'Family is archived',
    status: 422,
  });
});

it('SHOULD edit an imported discount WITHOUT a prepayment record (spec 048)', async () => {
  mocks.transactionRepository.findTransactionById.mockResolvedValueOnce({
    ...mocks.refund,
    category: { ...mocks.refund.category, systemKey: 'INSTALLMENT_PREPAYMENT_DISCOUNT' },
    prepaymentId: null,
  });

  await setup.execute({ ...mocks.input, description: 'Renamed' });

  expect(mocks.cardCreditRepository.updateRefund).toHaveBeenCalledWith(
    expect.objectContaining({ description: 'Renamed' }),
  );
});

it('SHOULD refuse to edit a discount that belongs to a prepayment', async () => {
  mocks.transactionRepository.findTransactionById.mockResolvedValueOnce({
    ...mocks.refund,
    category: { ...mocks.refund.category, systemKey: 'INSTALLMENT_PREPAYMENT_DISCOUNT' },
    prepaymentId: 'prepayment-1',
  });

  await expect(setup.execute({ ...mocks.input, description: 'x' })).rejects.toThrow(
    NotFoundException,
  );
});
