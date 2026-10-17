import { mocks, setup } from './card-credit.service.mocks';

describe('refunds', () => {
  it('SHOULD create with the body today over the query today AND map the row', async () => {
    const result = await setup.createRefund(
      mocks.userId,
      mocks.cardId,
      {
        date: '2026-10-16',
        description: 'Refund',
        invoiceMonth: '2026-10',
        today: '2026-10-16',
        value: 5,
      },
      '2026-10-17',
    );

    expect(mocks.useCases.createRefund.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        accessibleOwners: mocks.accessibleOwners,
        creditCardId: mocks.cardId,
        today: '2026-10-16',
      }),
    );
    expect(result).toEqual({
      creditCardId: mocks.cardId,
      date: mocks.refund.date,
      description: mocks.refund.description,
      id: mocks.refund.id,
      invoiceMonth: '2026-10',
      refundedPlanId: null,
      refundedTransactionId: null,
      value: mocks.refund.value,
    });
  });

  it('SHOULD update and delete through the use cases', async () => {
    await setup.updateRefund(
      mocks.userId,
      mocks.cardId,
      mocks.refund.id,
      { description: 'x' },
      '2026-10-16',
    );
    await setup.deleteRefund(mocks.userId, mocks.cardId, mocks.refund.id);

    expect(mocks.useCases.updateRefund.execute).toHaveBeenCalledWith(
      expect.objectContaining({ description: 'x', id: mocks.refund.id, today: '2026-10-16' }),
    );
    expect(mocks.useCases.deleteRefund.execute).toHaveBeenCalledWith({
      accessibleOwners: mocks.accessibleOwners,
      creditCardId: mocks.cardId,
      id: mocks.refund.id,
    });
  });
});

describe('early payments', () => {
  it('SHOULD create AND map the account row ids', async () => {
    const result = await setup.createEarlyPayment(mocks.userId, mocks.cardId, {
      accountId: mocks.early.paidFromAccountId,
      date: '2026-10-16',
      description: 'Early payment',
      invoiceMonth: '2026-10',
      method: 'ACCOUNT' as never,
      value: 5,
    });

    expect(result).toMatchObject({
      accountId: mocks.early.paidFromAccountId,
      accountTransactionId: mocks.early.paidFromTransactionId,
      method: 'ACCOUNT',
    });
  });

  it('SHOULD omit the account ids for a boleto', async () => {
    mocks.useCases.createEarly.execute.mockResolvedValue({
      ...mocks.early,
      paidFromAccountId: null,
      paidFromTransactionId: null,
      paymentMethod: 'EXTERNAL',
    });

    const result = await setup.createEarlyPayment(mocks.userId, mocks.cardId, {
      date: '2026-10-16',
      description: 'Early payment',
      invoiceMonth: '2026-10',
      method: 'EXTERNAL' as never,
      value: 5,
    });

    expect(result.accountId).toBeUndefined();
    expect(result.accountTransactionId).toBeUndefined();
  });

  it('SHOULD update and delete through the use cases', async () => {
    await setup.updateEarlyPayment(mocks.userId, mocks.cardId, mocks.early.id, { value: 5 });
    await setup.deleteEarlyPayment(mocks.userId, mocks.cardId, mocks.early.id);

    expect(mocks.useCases.updateEarly.execute).toHaveBeenCalledWith(
      expect.objectContaining({ id: mocks.early.id, value: 5 }),
    );
    expect(mocks.useCases.deleteEarly.execute).toHaveBeenCalledWith(
      expect.objectContaining({ id: mocks.early.id }),
    );
  });
});
