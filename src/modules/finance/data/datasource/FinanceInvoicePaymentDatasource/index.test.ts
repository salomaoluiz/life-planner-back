import { mocks, setup, spies } from './index.mocks';

describe('Method pay', () => {
  beforeEach(() => {
    spies.paymentFindFirst.mockResolvedValue(null);
    spies.aggregate.mockResolvedValue({ _sum: { value: 45000 } });
    spies.transactionGroupBy.mockResolvedValue([{ _sum: { value: 45000 }, type: 'EXPENSE' }]);
    spies.transactionCreate.mockResolvedValue({
      account_id: 'acc-1',
      id: 'tx-1',
      paid: true,
      type: 'EXPENSE',
      value: 45000,
    });
    spies.paymentCreate.mockResolvedValue(mocks.payment);
  });

  it('SHOULD lock the card, create the INVOICE_PAYMENT expense, lower the ledger AND create the record', async () => {
    expect(await setup.pay(mocks.payParams)).toEqual(mocks.payment);

    expect(spies.queryRaw).toHaveBeenCalledTimes(1);
    expect(spies.transactionCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        account_id: 'acc-1',
        category_id: 'cat-1',
        paid: true,
        type: 'EXPENSE',
        value: 45000,
      }),
    });
    expect(spies.accountUpdate).toHaveBeenCalledWith({
      data: { ledger_balance: { increment: -45000 } },
      where: { id: 'acc-1' },
    });
    expect(spies.paymentCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ transaction_id: 'tx-1' }) }),
    );
  });

  it('SHOULD write only the record WHEN the payment is EXTERNAL', async () => {
    await setup.pay({
      ...mocks.payParams,
      account_id: undefined,
      account_owner: undefined,
      account_owner_id: undefined,
      method: 'EXTERNAL',
    });

    expect(spies.transactionCreate).not.toHaveBeenCalled();
    expect(spies.accountUpdate).not.toHaveBeenCalled();
    expect(spies.paymentCreate).toHaveBeenCalledTimes(1);
  });

  it('SHOULD answer 409 WHEN the invoice is already paid', async () => {
    spies.paymentFindFirst.mockResolvedValue({ id: 'p' });

    await expect(setup.pay(mocks.payParams)).rejects.toThrow('Invoice already paid');
    expect(spies.paymentCreate).not.toHaveBeenCalled();
  });

  it('SHOULD answer 409 WHEN a purchase changed the invoice net after the caller read it', async () => {
    spies.transactionGroupBy.mockResolvedValue([{ _sum: { value: 46000 }, type: 'EXPENSE' }]);

    await expect(setup.pay(mocks.payParams)).rejects.toThrow('Invoice changed');
    expect(spies.transactionCreate).not.toHaveBeenCalled();
  });

  // Regression: the raw sum added the early payments (+) instead of subtracting them, so any invoice
  // with credits could never be paid again after an undo (409 "Invoice changed").
  it('SHOULD compare the NET (purchases minus credits) WHEN the invoice has early payments', async () => {
    spies.aggregate.mockResolvedValue({ _sum: { value: 95000 } });
    spies.transactionGroupBy.mockResolvedValue([
      { _sum: { value: 70000 }, type: 'EXPENSE' },
      { _sum: { value: 25000 }, type: 'INCOME' },
    ]);

    expect(await setup.pay(mocks.payParams)).toEqual(mocks.payment);

    expect(spies.paymentCreate).toHaveBeenCalledTimes(1);
  });
});

describe('Method undo', () => {
  it('SHOULD delete the record, then the transaction, AND restore the ledger', async () => {
    spies.paymentFindFirst.mockResolvedValue({ id: 'p-1', transaction_id: 'tx-1' });
    spies.queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([
      {
        account_id: 'acc-1',
        credit_card_id: null,
        invoice_month: null,
        paid: true,
        type: 'EXPENSE',
        value: 45000,
      },
    ]);

    await setup.undo('card-1', '2026-10');

    expect(spies.paymentDeleteMany.mock.invocationCallOrder[0]).toBeLessThan(
      spies.transactionDeleteMany.mock.invocationCallOrder[0],
    );
    expect(spies.accountUpdate).toHaveBeenCalledWith({
      data: { ledger_balance: { increment: 45000 } },
      where: { id: 'acc-1' },
    });
  });

  it('SHOULD only delete the record WHEN the payment was EXTERNAL', async () => {
    spies.paymentFindFirst.mockResolvedValue({ id: 'p-1', transaction_id: null });

    await setup.undo('card-1', '2026-10');

    expect(spies.transactionDeleteMany).not.toHaveBeenCalled();
    expect(spies.accountUpdate).not.toHaveBeenCalled();
  });

  it('SHOULD answer 404 WHEN there is no payment', async () => {
    spies.paymentFindFirst.mockResolvedValue(null);

    await expect(setup.undo('card-1', '2026-10')).rejects.toThrow();
  });
});

describe('queries', () => {
  it('SHOULD find by card and month, by card ids (one query) AND check existence by owner', async () => {
    spies.paymentFindFirst.mockResolvedValueOnce(mocks.payment).mockResolvedValueOnce({ id: 'x' });
    spies.paymentFindMany.mockResolvedValue([mocks.payment]);

    expect(await setup.findByCardAndMonth('card-1', '2026-10')).toEqual(mocks.payment);
    expect(await setup.findByCardIds(['card-1'])).toEqual([mocks.payment]);
    expect(await setup.findByCardIds([])).toEqual([]);
    expect(await setup.exists({ owner: 'USER', owner_id: 'o' })).toBe(true);
    expect(spies.paymentFindMany).toHaveBeenCalledTimes(1);
  });
});
