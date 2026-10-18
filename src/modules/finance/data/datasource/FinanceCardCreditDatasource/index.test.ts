import { mocks, setup, spies } from './index.mocks';

const REFUND = '00000000-0000-4000-8000-000000000004';
const EARLY = '00000000-0000-4000-8000-000000000005';

describe('Method createRefund', () => {
  beforeEach(() => spies.create.mockResolvedValue({ id: 'refund-1' }));

  it('SHOULD lock the card AND insert an INCOME row on the chosen invoice', async () => {
    await setup.createRefund(mocks.refundParams);

    expect(spies.queryRaw).toHaveBeenCalledTimes(1);
    expect(spies.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          credit_card_id: 'card-1',
          invoice_month: '2026-10',
          refunded_transaction_id: 'purchase-1',
          type: 'INCOME',
          value: 20000,
        }),
      }),
    );
  });

  it('SHOULD answer 422 WHEN the invoice has a payment record', async () => {
    spies.paymentFindFirst.mockResolvedValue({ id: 'p' });

    await expect(setup.createRefund(mocks.refundParams)).rejects.toThrow('Invoice is paid');
    expect(spies.create).not.toHaveBeenCalled();
  });

  it('SHOULD answer 422 WHEN the linked refunds would pass the purchase value', async () => {
    spies.aggregate.mockResolvedValue({ _sum: { value: 30001 } });

    await expect(setup.createRefund(mocks.refundParams)).rejects.toThrow("can't exceed");
  });

  it('SHOULD skip the cap WHEN the refund is standalone', async () => {
    await setup.createRefund({
      ...mocks.refundParams,
      max_linked: undefined,
      refunded_transaction_id: undefined,
    });

    expect(spies.aggregate).not.toHaveBeenCalled();
  });
});

describe('Method updateRefund', () => {
  beforeEach(() => {
    spies.findUniqueOrThrow.mockResolvedValue({
      category_id: REFUND,
      credit_card_id: 'card-1',
      invoice_month: '2026-10',
      refunded_plan_id: null,
      refunded_transaction_id: 'purchase-1',
      value: 20000,
    });
    spies.update.mockResolvedValue({ id: 'refund-1' });
  });

  it('SHOULD change the value AFTER re-checking the cap without counting itself', async () => {
    await setup.updateRefund({ id: 'refund-1', max_linked: 50000, value: 25000 });

    expect(spies.aggregate).toHaveBeenCalledWith({
      _sum: { value: true },
      where: { id: { not: 'refund-1' }, refunded_transaction_id: 'purchase-1' },
    });
    expect(spies.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ value: 25000 }) }),
    );
  });

  it('SHOULD allow a description change WITHOUT looking at the payments', async () => {
    await setup.updateRefund({ description: 'x', id: 'refund-1' });

    expect(spies.paymentFindFirst).not.toHaveBeenCalled();
  });

  it('SHOULD answer 422 for any other change WHEN the invoice is paid', async () => {
    spies.paymentFindFirst.mockResolvedValue({ id: 'p' });

    await expect(setup.updateRefund({ id: 'refund-1', value: 1 })).rejects.toThrow(
      'Invoice is paid',
    );
  });

  it('SHOULD answer 404 WHEN the row is missing AND 422 WHEN it is not a credit', async () => {
    spies.queryRaw.mockResolvedValueOnce([]);
    spies.queryRaw.mockResolvedValueOnce([]);
    await expect(setup.updateRefund({ id: 'missing' })).rejects.toThrow();

    spies.findUniqueOrThrow.mockResolvedValue({ category_id: 'other' });
    await expect(setup.updateRefund({ id: 'refund-1' })).rejects.toThrow('Not a refund');
  });
});

describe('Method createEarlyPayment', () => {
  beforeEach(() => {
    spies.create.mockResolvedValueOnce({
      account_id: 'acc-1',
      id: 'debit-1',
      paid: true,
      type: 'EXPENSE',
      value: 60000,
    });
    spies.create.mockResolvedValue({ id: 'early-1' });
  });

  it('SHOULD create the INVOICE_PAYMENT debit, lower the ledger AND link the card row to it', async () => {
    await setup.createEarlyPayment(mocks.earlyParams);

    expect(spies.create).toHaveBeenNthCalledWith(1, {
      data: expect.objectContaining({
        account_id: 'acc-1',
        category_id: '00000000-0000-4000-8000-000000000002',
        paid: true,
        type: 'EXPENSE',
        value: 60000,
      }),
    });
    expect(spies.accountUpdate).toHaveBeenCalledWith({
      data: { ledger_balance: { increment: -60000 } },
      where: { id: 'acc-1' },
    });
    expect(spies.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({
          category_id: EARLY,
          paid_from_transaction_id: 'debit-1',
          payment_method: 'ACCOUNT',
          type: 'INCOME',
        }),
      }),
    );
  });

  it('SHOULD write only the card row WHEN paid by boleto', async () => {
    spies.create.mockReset();
    spies.create.mockResolvedValue({ id: 'early-1' });

    await setup.createEarlyPayment({
      ...mocks.earlyParams,
      account: undefined,
      method: 'EXTERNAL',
    });

    expect(spies.create).toHaveBeenCalledTimes(1);
    expect(spies.accountUpdate).not.toHaveBeenCalled();
    expect(spies.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          paid_from_transaction_id: null,
          payment_method: 'EXTERNAL',
        }),
      }),
    );
  });

  it('SHOULD answer 409 WHEN the invoice changed after the caller read it', async () => {
    spies.groupBy.mockResolvedValue([{ _sum: { value: 99999 }, type: 'EXPENSE' }]);

    await expect(setup.createEarlyPayment(mocks.earlyParams)).rejects.toThrow('Invoice changed');
    expect(spies.create).not.toHaveBeenCalled();
  });

  it('SHOULD answer 422 WHEN the invoice is paid AND 400 WHEN ACCOUNT has no account', async () => {
    spies.paymentFindFirst.mockResolvedValue({ id: 'p' });
    await expect(setup.createEarlyPayment(mocks.earlyParams)).rejects.toThrow('Invoice is paid');

    spies.paymentFindFirst.mockResolvedValue(null);
    await expect(
      setup.createEarlyPayment({ ...mocks.earlyParams, account: undefined }),
    ).rejects.toThrow('account is required');
  });
});

describe('Method updateEarlyPayment', () => {
  const stored = {
    category_id: EARLY,
    credit_card_id: 'card-1',
    date: new Date('2026-10-16T00:00:00.000Z'),
    invoice_month: '2026-10',
    paid_from_transaction_id: 'debit-1',
    payment_method: 'ACCOUNT',
    value: 60000,
  };

  beforeEach(() => {
    spies.findUniqueOrThrow.mockResolvedValue(stored);
    spies.update.mockResolvedValue({
      account_id: 'acc-1',
      id: 'early-1',
      paid: true,
      type: 'EXPENSE',
      value: 1,
    });
  });

  it('SHOULD keep the debit row in step WHEN the value changes', async () => {
    await setup.updateEarlyPayment({ id: 'early-1', value: 50000 });

    expect(spies.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ value: 50000 }),
        where: { id: 'debit-1' },
      }),
    );
    expect(spies.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          paid_from_transaction_id: 'debit-1',
          payment_method: 'ACCOUNT',
        }),
        where: { id: 'early-1' },
      }),
    );
  });

  it('SHOULD delete the debit row AND restore the balance WHEN it becomes a boleto', async () => {
    spies.queryRaw.mockResolvedValue([
      {
        account_id: 'acc-1',
        credit_card_id: null,
        invoice_month: null,
        paid: true,
        type: 'EXPENSE',
        value: 60000,
      },
    ]);

    await setup.updateEarlyPayment({ id: 'early-1', method: 'EXTERNAL' });

    expect(spies.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          paid_from_transaction_id: null,
          payment_method: 'EXTERNAL',
        }),
      }),
    );
    expect(spies.deleteMany).toHaveBeenCalledWith({ where: { id: 'debit-1' } });
    expect(spies.accountUpdate).toHaveBeenCalledWith({
      data: { ledger_balance: { increment: 60000 } },
      where: { id: 'acc-1' },
    });
  });

  it('SHOULD create the debit row WHEN a boleto becomes an account payment', async () => {
    spies.findUniqueOrThrow.mockResolvedValue({
      ...stored,
      paid_from_transaction_id: null,
      payment_method: 'EXTERNAL',
    });
    spies.create.mockResolvedValue({
      account_id: 'acc-2',
      id: 'debit-2',
      paid: true,
      type: 'EXPENSE',
      value: 60000,
    });

    await setup.updateEarlyPayment({
      account: { id: 'acc-2', owner: 'USER', owner_id: 'owner-1' },
      account_description: 'Early payment · Card (2026-10)',
      id: 'early-1',
      method: 'ACCOUNT',
    });

    expect(spies.create).toHaveBeenCalledTimes(1);
    expect(spies.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          paid_from_transaction_id: 'debit-2',
          payment_method: 'ACCOUNT',
        }),
      }),
    );
  });

  it('SHOULD answer 422 for a value change WHEN the invoice is paid, but allow the description', async () => {
    spies.paymentFindFirst.mockResolvedValue({ id: 'p' });

    await expect(setup.updateEarlyPayment({ id: 'early-1', value: 1 })).rejects.toThrow(
      'Invoice is paid',
    );

    await setup.updateEarlyPayment({ description: 'x', id: 'early-1' });
    expect(spies.update).toHaveBeenCalled();
  });

  it('SHOULD answer 409 WHEN the net changed AND 404 WHEN the row is missing', async () => {
    spies.groupBy.mockResolvedValue([{ _sum: { value: 1 }, type: 'EXPENSE' }]);
    await expect(
      setup.updateEarlyPayment({ expected_net: 5, id: 'early-1', value: 1 }),
    ).rejects.toThrow('Invoice changed');

    spies.queryRaw.mockResolvedValue([]);
    await expect(setup.updateEarlyPayment({ id: 'missing' })).rejects.toThrow();
  });
});

describe('Method deleteCredit', () => {
  it('SHOULD delete the card row first, then the debit row with its ledger', async () => {
    spies.findUniqueOrThrow.mockResolvedValue({
      category_id: EARLY,
      paid_from_transaction_id: 'debit-1',
    });
    spies.queryRaw.mockResolvedValue([
      {
        account_id: 'acc-1',
        credit_card_id: 'card-1',
        invoice_month: '2026-10',
        paid: true,
        type: 'EXPENSE',
        value: 60000,
      },
    ]);

    await setup.deleteCredit('early-1');

    expect(spies.deleteMany).toHaveBeenNthCalledWith(1, { where: { id: 'early-1' } });
    expect(spies.deleteMany).toHaveBeenNthCalledWith(2, { where: { id: 'debit-1' } });
    expect(spies.accountUpdate).toHaveBeenCalledWith({
      data: { ledger_balance: { increment: 60000 } },
      where: { id: 'acc-1' },
    });
  });

  it('SHOULD delete a refund alone, do nothing for a missing row AND refuse a paid invoice', async () => {
    spies.findUniqueOrThrow.mockResolvedValue({
      category_id: REFUND,
      paid_from_transaction_id: null,
    });
    await setup.deleteCredit('refund-1');
    expect(spies.deleteMany).toHaveBeenCalledTimes(1);

    spies.deleteMany.mockClear();
    spies.queryRaw.mockResolvedValue([]);
    await setup.deleteCredit('missing');
    expect(spies.deleteMany).not.toHaveBeenCalled();

    spies.queryRaw.mockResolvedValue([mocks.lockedRow]);
    spies.paymentFindFirst.mockResolvedValue({ id: 'p' });
    await expect(setup.deleteCredit('refund-1')).rejects.toThrow('Invoice is paid');
  });

  it('SHOULD refuse a row that is not a credit', async () => {
    spies.findUniqueOrThrow.mockResolvedValue({
      category_id: 'other',
      paid_from_transaction_id: null,
    });

    await expect(setup.deleteCredit('x')).rejects.toThrow('Not a refund');
  });
});

describe('refund counters', () => {
  it('SHOULD count the refunds linked to a purchase and to a plan', async () => {
    spies.count.mockResolvedValue(2);

    expect(await setup.countRefundsByTransactionId('t')).toBe(2);
    expect(await setup.countRefundsByPlanId('p')).toBe(2);
    expect(spies.count).toHaveBeenCalledWith({ where: { refunded_plan_id: 'p' } });
  });
});
