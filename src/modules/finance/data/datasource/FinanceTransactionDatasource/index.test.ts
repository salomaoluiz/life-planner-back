import { NotFoundException } from '@nestjs/common';

import { TransactionSource } from '@finance/domain/enum';

import { mocks, setup, spies } from './index.mocks';

describe('Method countByAccountId / countByCategoryIds', () => {
  it('SHOULD count the transactions of an account', async () => {
    spies.count.mockResolvedValue(3);

    expect(await setup.countByAccountId('acc-1')).toBe(3);
    expect(spies.count).toHaveBeenCalledWith({ where: { account_id: 'acc-1' } });
  });

  it('SHOULD count the transactions AND the installment plans of ANY of the given categories', async () => {
    spies.count.mockResolvedValue(1);
    spies.planCount.mockResolvedValue(2);

    expect(await setup.countByCategoryIds(['c1', 'c2'])).toBe(3);
    expect(spies.count).toHaveBeenCalledWith({ where: { category_id: { in: ['c1', 'c2'] } } });
    expect(spies.planCount).toHaveBeenCalledWith({ where: { category_id: { in: ['c1', 'c2'] } } });
  });
});

describe('Method create', () => {
  const params = {
    account_id: mocks.transaction.account_id,
    category_id: mocks.transaction.category_id,
    date: new Date('2026-10-03T00:00:00.000Z'),
    description: 'Weekly groceries',
    owner: 'USER' as const,
    owner_id: mocks.transaction.owner_id,
    type: 'EXPENSE' as const,
    value: 23490,
  };

  it('SHOULD insert the row AND move the ledger of its account in the SAME database transaction', async () => {
    spies.create.mockResolvedValue(mocks.transaction);

    expect(await setup.create(params)).toEqual(mocks.transaction);
    expect(spies.transaction).toHaveBeenCalledTimes(1);
    expect(spies.create).toHaveBeenCalledWith({ data: params, include: mocks.include });
    expect(spies.accountUpdate).toHaveBeenCalledWith({
      data: { ledger_balance: { increment: -23490 } },
      where: { id: mocks.transaction.account_id },
    });
  });

  it('SHOULD add an INCOME to the ledger', async () => {
    spies.create.mockResolvedValue({ ...mocks.transaction, type: 'INCOME', value: 500 });

    await setup.create({ ...params, type: 'INCOME', value: 500 });

    expect(spies.accountUpdate).toHaveBeenCalledWith({
      data: { ledger_balance: { increment: 500 } },
      where: { id: mocks.transaction.account_id },
    });
  });

  it('SHOULD propagate a failure of the ledger update so the whole transaction rolls back', async () => {
    spies.create.mockResolvedValue(mocks.transaction);
    spies.accountUpdate.mockRejectedValueOnce(new Error('ledger down'));

    await expect(setup.create(params)).rejects.toThrow('ledger down');
  });
});

describe('Method delete', () => {
  it('SHOULD lock the row, delete it AND reverse its signed value on the ledger', async () => {
    spies.queryRaw.mockResolvedValue([{ account_id: 'acc-1', type: 'EXPENSE', value: 1000 }]);
    spies.deleteMany.mockResolvedValue({ count: 1 });

    await expect(setup.delete(mocks.transaction.id)).resolves.toBeUndefined();

    expect(spies.queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      spies.deleteMany.mock.invocationCallOrder[0],
    );
    expect(spies.deleteMany).toHaveBeenCalledWith({ where: { id: mocks.transaction.id } });
    expect(spies.accountUpdate).toHaveBeenCalledWith({
      data: { ledger_balance: { increment: 1000 } },
      where: { id: 'acc-1' },
    });
  });

  it('SHOULD do nothing (idempotent) WHEN the row is already gone', async () => {
    spies.queryRaw.mockResolvedValue([]);

    await expect(setup.delete(mocks.transaction.id)).resolves.toBeUndefined();

    expect(spies.deleteMany).not.toHaveBeenCalled();
    expect(spies.accountUpdate).not.toHaveBeenCalled();
  });
});

describe('Method exists', () => {
  it('SHOULD return true / false from a cheap findFirst on (owner, owner_id)', async () => {
    spies.findFirst.mockResolvedValueOnce({ id: 'x' }).mockResolvedValueOnce(null);
    const params = { owner: 'FAMILY' as const, owner_id: 'family-id' };

    expect(await setup.exists(params)).toBe(true);
    expect(await setup.exists(params)).toBe(false);
    expect(spies.findFirst).toHaveBeenCalledWith({
      select: { id: true },
      where: { owner: 'FAMILY', owner_id: 'family-id' },
    });
  });
});

describe('Method findById', () => {
  it('SHOULD return the row with relations, or null WHEN not found', async () => {
    spies.findUnique.mockResolvedValueOnce(mocks.transaction).mockResolvedValueOnce(null);

    expect(await setup.findById(mocks.transaction.id)).toEqual(mocks.transaction);
    expect(await setup.findById('missing')).toBeNull();
    expect(spies.findUnique).toHaveBeenCalledWith({
      include: mocks.include,
      where: { id: mocks.transaction.id },
    });
  });
});

describe('Method findByOwners', () => {
  it('SHOULD query every owner in ONE findMany, joined, sorted by date desc then created_at desc', async () => {
    spies.findMany.mockResolvedValue([mocks.transaction]);

    const result = await setup.findByOwners(mocks.owners);

    expect(result).toEqual([mocks.transaction]);
    expect(spies.findMany).toHaveBeenCalledTimes(1);
    expect(spies.findMany).toHaveBeenCalledWith({
      include: mocks.include,
      orderBy: [{ date: 'desc' }, { created_at: 'desc' }],
      where: {
        AND: [
          { OR: [{ owner: 'USER', owner_id: mocks.owners[0].ownerId }] },
          {
            category: { OR: [{ system_key: null }, { system_key: { not: 'INVOICE_PAYMENT' } }] },
            credit_card_id: null,
          },
        ],
      },
    });
  });

  it('SHOULD query card purchases WHEN the source is CARD', async () => {
    spies.findMany.mockResolvedValue([]);

    await setup.findByOwners(mocks.owners, TransactionSource.CARD, { invoiceMonth: '2026-10' });

    expect(spies.findMany.mock.calls[0][0].where.AND[1]).toEqual({
      credit_card_id: { not: null },
      invoice_month: '2026-10',
    });
  });
});

describe('Method update', () => {
  const lockedRow = [{ account_id: 'acc-1', type: 'EXPENSE', value: 1000 }];

  it('SHOULD update only the sent columns AND return the row with relations', async () => {
    spies.queryRaw.mockResolvedValue(lockedRow);
    spies.update.mockResolvedValue({ ...mocks.transaction, account_id: 'acc-1', value: 100 });

    const result = await setup.update({ description: 'New', id: mocks.transaction.id, value: 100 });

    expect(result).toEqual({ ...mocks.transaction, account_id: 'acc-1', value: 100 });
    expect(spies.update).toHaveBeenCalledWith({
      data: {
        account_id: undefined,
        category_id: undefined,
        date: undefined,
        description: 'New',
        owner: undefined,
        owner_id: undefined,
        type: undefined,
        value: 100,
      },
      include: mocks.include,
      where: { id: mocks.transaction.id },
    });
  });

  it('SHOULD lock the stored row BEFORE updating AND compute the delta from the LOCKED row (not from an earlier read)', async () => {
    spies.queryRaw.mockResolvedValue(lockedRow); // another request already changed it to 1000
    spies.update.mockResolvedValue({
      ...mocks.transaction,
      account_id: 'acc-1',
      type: 'EXPENSE',
      value: 1500,
    });

    await setup.update({ id: mocks.transaction.id, value: 1500 });

    expect(spies.queryRaw.mock.calls[0][0].sql).toContain('FOR UPDATE');
    expect(spies.queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      spies.update.mock.invocationCallOrder[0],
    );
    expect(spies.accountUpdate).toHaveBeenCalledTimes(1);
    expect(spies.accountUpdate).toHaveBeenCalledWith({
      data: { ledger_balance: { increment: -500 } },
      where: { id: 'acc-1' },
    });
  });

  it('SHOULD reverse the old account AND apply the new one WHEN the account changes (ascending id order)', async () => {
    spies.queryRaw.mockResolvedValue([{ account_id: 'acc-b', type: 'EXPENSE', value: 200 }]);
    spies.update.mockResolvedValue({
      ...mocks.transaction,
      account_id: 'acc-a',
      type: 'EXPENSE',
      value: 200,
    });

    await setup.update({ account_id: 'acc-a', id: mocks.transaction.id });

    expect(spies.accountUpdate).toHaveBeenNthCalledWith(1, {
      data: { ledger_balance: { increment: -200 } },
      where: { id: 'acc-a' },
    });
    expect(spies.accountUpdate).toHaveBeenNthCalledWith(2, {
      data: { ledger_balance: { increment: 200 } },
      where: { id: 'acc-b' },
    });
  });

  it('SHOULD not touch any account WHEN the effect on the ledger is unchanged (description only)', async () => {
    spies.queryRaw.mockResolvedValue(lockedRow);
    spies.update.mockResolvedValue({
      ...mocks.transaction,
      account_id: 'acc-1',
      type: 'EXPENSE',
      value: 1000,
    });

    await setup.update({ description: 'Renamed', id: mocks.transaction.id });

    expect(spies.accountUpdate).not.toHaveBeenCalled();
  });

  it('SHOULD throw NotFound AND write nothing WHEN the row vanished before the lock', async () => {
    spies.queryRaw.mockResolvedValue([]);

    await expect(setup.update({ id: mocks.transaction.id, value: 1 })).rejects.toThrow(
      NotFoundException,
    );
    expect(spies.update).not.toHaveBeenCalled();
    expect(spies.accountUpdate).not.toHaveBeenCalled();
  });
});

describe('Card purchases', () => {
  const cardParams = {
    account_id: null,
    category_id: mocks.transaction.category_id,
    credit_card_id: 'card-1',
    date: new Date('2026-10-03T00:00:00.000Z'),
    description: 'Market',
    invoice_month: '2026-10',
    owner: 'USER' as const,
    owner_id: mocks.transaction.owner_id,
    type: 'EXPENSE' as const,
    value: 1000,
  };

  it('SHOULD lock the card, create the row and NOT touch any account ledger', async () => {
    spies.paymentFindFirst.mockResolvedValue(null);
    spies.create.mockResolvedValue({ ...mocks.transaction, account_id: null });

    await setup.create(cardParams);

    expect(spies.queryRaw).toHaveBeenCalledTimes(1);
    expect(spies.accountUpdate).not.toHaveBeenCalled();
  });

  it('SHOULD reject with 422 WHEN the invoice already has a payment', async () => {
    spies.paymentFindFirst.mockResolvedValue({ id: 'payment-1' });

    await expect(setup.create(cardParams)).rejects.toThrow('Invoice is paid');
    expect(spies.create).not.toHaveBeenCalled();
  });

  it('SHOULD refuse to delete a purchase of a paid invoice', async () => {
    spies.findUnique.mockResolvedValue({ credit_card_id: 'card-1' });
    spies.queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([
      {
        account_id: null,
        credit_card_id: 'card-1',
        invoice_month: '2026-10',
        type: 'EXPENSE',
        value: 1000,
      },
    ]);
    spies.paymentFindFirst.mockResolvedValue({ id: 'payment-1' });

    await expect(setup.delete('tx-1')).rejects.toThrow('Invoice is paid');
    expect(spies.deleteMany).not.toHaveBeenCalled();
  });

  it('SHOULD sum the invoices of the cards in ONE grouped query', async () => {
    spies.groupBy.mockResolvedValue([
      { _sum: { value: 450 }, credit_card_id: 'card-1', invoice_month: '2026-10' },
    ]);

    expect(await setup.sumCardInvoices(['card-1'])).toEqual([
      { amount: 450, credit_card_id: 'card-1', invoice_month: '2026-10' },
    ]);
    expect(await setup.sumCardInvoices([])).toEqual([]);
    expect(spies.groupBy).toHaveBeenCalledTimes(1);
  });

  it('SHOULD return no purchases without keys AND count by card', async () => {
    expect(await setup.findCardPurchases([])).toEqual([]);
    spies.count.mockResolvedValue(2);
    expect(await setup.countByCreditCardId('card-1')).toBe(2);
  });
});

describe('Method update on a paid invoice (spec 030 FR 16)', () => {
  const lockedRow = [
    {
      account_id: null,
      credit_card_id: 'card-1',
      invoice_month: '2026-10',
      type: 'EXPENSE',
      value: 1000,
    },
  ];

  it('SHOULD allow description and category WITHOUT looking at the payments', async () => {
    spies.queryRaw.mockResolvedValue(lockedRow);
    spies.paymentFindFirst.mockResolvedValue({ id: 'payment-1' });
    spies.update.mockResolvedValue(mocks.transaction);

    await setup.update({ category_id: 'cat-2', description: 'New', id: mocks.transaction.id });

    expect(spies.paymentFindFirst).not.toHaveBeenCalled();
    expect(spies.update).toHaveBeenCalledTimes(1);
  });

  it('SHOULD refuse a value change (422)', async () => {
    spies.queryRaw.mockResolvedValue(lockedRow);
    spies.paymentFindFirst.mockResolvedValue({ id: 'payment-1' });

    await expect(setup.update({ id: mocks.transaction.id, value: 5 })).rejects.toThrow(
      'Invoice is paid',
    );
    expect(spies.update).not.toHaveBeenCalled();
  });
});
