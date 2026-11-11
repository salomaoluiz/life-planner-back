import { NotFoundException } from '@nestjs/common';

import { mocks, setup, spies } from './index.mocks';

describe('writeIncome', () => {
  beforeEach(() => {
    spies.accountFindUnique.mockResolvedValue({ owner: 'USER', owner_id: 'owner-1' });
    spies.transactionCreate.mockResolvedValue({ id: 'tx-1' });
    spies.incomeCreate.mockResolvedValue({ id: 'inc-1' });
  });

  it('SHOULD create the income, one locked INCOME row AND add a received amount to the account', async () => {
    expect(await setup.writeIncome(mocks.params)).toBe('inc-1');

    expect(spies.transactionCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        account_id: 'acc-1',
        category_id: 'cat-1',
        description: 'PETR4',
        external_lock: 'INVESTMENT',
        owner: 'USER',
        owner_id: 'owner-1',
        paid: true,
        type: 'INCOME',
        value: 7140,
      }),
    });
    expect(spies.incomeCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        asset_id: 'asset-1',
        created_by: 'user-1',
        net_amount: 7140,
        suggestion_id: null,
        transaction_id: 'tx-1',
        type: 'JCP',
      }),
    });
    expect(spies.accountUpdate).toHaveBeenCalledWith({
      data: { ledger_balance: { increment: 7140 } },
      where: { id: 'acc-1' },
    });
  });

  it('SHOULD leave the ledger alone WHEN the income is planned', async () => {
    await setup.writeIncome({ ...mocks.params, paid: false });

    expect(spies.transactionCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ paid: false }),
    });
    expect(spies.accountUpdate).not.toHaveBeenCalled();
  });

  it('SHOULD approve the suggestion in the same transaction', async () => {
    await setup.writeIncome({ ...mocks.params, suggestionId: 'sug-1' });

    expect(spies.incomeCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ suggestion_id: 'sug-1' }),
    });
    expect(spies.suggestionUpdate).toHaveBeenCalledWith({
      data: expect.objectContaining({ decided_by: 'user-1', status: 'APPROVED' }),
      where: { id: 'sug-1' },
    });
  });

  it('SHOULD move only the difference WHEN a planned income is received with another amount', async () => {
    spies.incomeFindUnique.mockResolvedValue({
      id: 'inc-1',
      transaction: { account_id: 'acc-1', paid: false, type: 'INCOME', value: 7140 },
      transaction_id: 'tx-1',
    });
    spies.incomeUpdate.mockResolvedValue({ id: 'inc-1' });

    await setup.writeIncome({ ...mocks.params, incomeId: 'inc-1', netAmount: 7215 });

    expect(spies.transactionUpdate).toHaveBeenCalledWith({
      data: expect.objectContaining({ paid: true, value: 7215 }),
      where: { id: 'tx-1' },
    });
    expect(spies.accountUpdate).toHaveBeenCalledWith({
      data: { ledger_balance: { increment: 7215 } },
      where: { id: 'acc-1' },
    });
    expect(spies.suggestionUpdate).not.toHaveBeenCalled();
  });

  it('SHOULD move the amount between accounts WHEN a received income changes account', async () => {
    spies.incomeFindUnique.mockResolvedValue({
      id: 'inc-1',
      transaction: { account_id: 'acc-0', paid: true, type: 'INCOME', value: 7140 },
      transaction_id: 'tx-1',
    });
    spies.incomeUpdate.mockResolvedValue({ id: 'inc-1' });

    await setup.writeIncome({ ...mocks.params, incomeId: 'inc-1' });

    expect(spies.accountUpdate).toHaveBeenCalledWith({
      data: { ledger_balance: { increment: -7140 } },
      where: { id: 'acc-0' },
    });
    expect(spies.accountUpdate).toHaveBeenCalledWith({
      data: { ledger_balance: { increment: 7140 } },
      where: { id: 'acc-1' },
    });
  });

  it('SHOULD give the amount back WHEN a received income goes back to planned', async () => {
    spies.incomeFindUnique.mockResolvedValue({
      id: 'inc-1',
      transaction: { account_id: 'acc-1', paid: true, type: 'INCOME', value: 7140 },
      transaction_id: 'tx-1',
    });
    spies.incomeUpdate.mockResolvedValue({ id: 'inc-1' });

    await setup.writeIncome({ ...mocks.params, incomeId: 'inc-1', paid: false });

    expect(spies.accountUpdate).toHaveBeenCalledWith({
      data: { ledger_balance: { increment: -7140 } },
      where: { id: 'acc-1' },
    });
  });

  it('SHOULD answer 404 for an unknown income OR account', async () => {
    spies.incomeFindUnique.mockResolvedValue(null);
    await expect(setup.writeIncome({ ...mocks.params, incomeId: 'x' })).rejects.toBeInstanceOf(
      NotFoundException,
    );

    spies.accountFindUnique.mockResolvedValue(null);
    await expect(setup.writeIncome(mocks.params)).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('deleteIncome', () => {
  it('SHOULD delete the income AND its row, give a received amount back AND dismiss the suggestion', async () => {
    spies.incomeFindUnique.mockResolvedValue({
      asset_id: 'asset-1',
      suggestion_id: 'sug-1',
      transaction: { account_id: 'acc-1', paid: true, type: 'INCOME', value: 7140 },
      transaction_id: 'tx-1',
    });

    await setup.deleteIncome('inc-1');

    expect(spies.incomeDelete).toHaveBeenCalledWith({ where: { id: 'inc-1' } });
    expect(spies.transactionDelete).toHaveBeenCalledWith({ where: { id: 'tx-1' } });
    expect(spies.accountUpdate).toHaveBeenCalledWith({
      data: { ledger_balance: { increment: -7140 } },
      where: { id: 'acc-1' },
    });
    expect(spies.suggestionUpdate).toHaveBeenCalledWith({
      data: { status: 'DISMISSED' },
      where: { id: 'sug-1' },
    });
  });

  it('SHOULD not touch the ledger WHEN the income was planned', async () => {
    spies.incomeFindUnique.mockResolvedValue({
      asset_id: 'asset-1',
      suggestion_id: null,
      transaction: { account_id: 'acc-1', paid: false, type: 'INCOME', value: 7140 },
      transaction_id: 'tx-1',
    });

    await setup.deleteIncome('inc-1');

    expect(spies.accountUpdate).not.toHaveBeenCalled();
    expect(spies.suggestionUpdate).not.toHaveBeenCalled();
  });

  it('SHOULD do nothing for a missing income', async () => {
    spies.incomeFindUnique.mockResolvedValue(null);

    await setup.deleteIncome('inc-1');

    expect(spies.incomeDelete).not.toHaveBeenCalled();
  });
});

describe('reads', () => {
  it('SHOULD list with keyset, status, type AND period filters', async () => {
    spies.incomeFindMany.mockResolvedValue([]);

    await setup.findIncomes({
      cursor: { id: 'inc-9', paymentDate: '2026-10-30' },
      from: '2026-01-01',
      limit: 51,
      owners: [{ owner: 'USER' as never, ownerId: 'u' }],
      status: 'PLANNED',
      to: '2026-12-31',
      type: 'JCP' as never,
    });

    const args = spies.incomeFindMany.mock.calls[0][0];

    expect(args.take).toBe(51);
    expect(args.orderBy).toEqual([{ payment_date: 'desc' }, { id: 'desc' }]);
    expect(args.where.AND).toHaveLength(2);
    expect(args.where.asset).toEqual({ OR: [{ owner: 'USER', owner_id: 'u' }] });
    expect(args.where.type).toBe('JCP');
  });

  it('SHOULD list one asset without the owner filter', async () => {
    spies.incomeFindMany.mockResolvedValue([]);

    await setup.findIncomes({ assetId: 'asset-1', limit: 10, owners: [] });

    expect(spies.incomeFindMany.mock.calls[0][0].where).toMatchObject({ asset_id: 'asset-1' });
  });

  it('SHOULD read the default account from the earliest BUY with a row', async () => {
    spies.operationFindFirst.mockResolvedValue({ account_id: 'acc-1' });
    expect(await setup.findDefaultAccountId('asset-1')).toBe('acc-1');

    spies.operationFindFirst.mockResolvedValue(null);
    expect(await setup.findDefaultAccountId('asset-1')).toBeNull();
  });

  it('SHOULD read the last category of the type in the owner', async () => {
    spies.incomeFindFirst.mockResolvedValue({ transaction: { category_id: 'cat-9' } });
    expect(await setup.findLastIncomeCategoryId('USER' as never, 'u', 'JCP')).toBe('cat-9');

    spies.incomeFindFirst.mockResolvedValue(null);
    expect(await setup.findLastIncomeCategoryId('USER' as never, 'u', 'JCP')).toBeNull();
  });

  it('SHOULD total received (year) AND planned (all) incomes', async () => {
    spies.incomeAggregate
      .mockResolvedValueOnce({ _sum: { net_amount: 128460 } })
      .mockResolvedValueOnce({ _sum: { net_amount: null } });

    expect(
      await setup.incomeTotals('asset-1', new Date('2026-01-01'), new Date('2026-12-31')),
    ).toEqual({ planned: 0, received: 128460 });
  });

  it('SHOULD look up by id, transaction id, category, events AND suggestions', async () => {
    spies.incomeFindUnique.mockResolvedValue({ id: 'inc-1' });
    spies.categoryFindUnique.mockResolvedValue({ id: 'cat-1' });
    spies.suggestionFindUnique.mockResolvedValue({ id: 'sug-1' });
    spies.suggestionFindMany.mockResolvedValue([]);
    spies.suggestionCount.mockResolvedValue(2);
    spies.eventFindMany.mockResolvedValue([]);

    expect(await setup.findIncomeById('inc-1')).toEqual({ id: 'inc-1' });
    expect(await setup.findIncomeByTransactionId('tx-1')).toEqual({ id: 'inc-1' });
    expect(await setup.findCategoryById('cat-1')).toEqual({ id: 'cat-1' });
    expect(await setup.findSuggestionById('sug-1')).toEqual({ id: 'sug-1' });
    expect(await setup.findPendingSuggestions(['asset-1'])).toEqual([]);
    expect(await setup.countPendingSuggestions('asset-1')).toBe(2);
    expect(await setup.findEvents([], new Date())).toEqual([]);
    expect(spies.eventFindMany).not.toHaveBeenCalled();

    await setup.findEvents([{ market: 'B3', ticker: 'PETR4' }], new Date('2026-01-01'));
    expect(spies.eventFindMany).toHaveBeenCalledTimes(1);
  });
});

describe('suggestions and events', () => {
  it('SHOULD create suggestions skipping duplicates, AND nothing for an empty list', async () => {
    spies.suggestionCreateMany.mockResolvedValue({ count: 1 });

    expect(await setup.createSuggestions([])).toBe(0);
    expect(await setup.createSuggestions([{ asset_id: 'a', event_id: 'e', quantity: '1' }])).toBe(
      1,
    );
    expect(spies.suggestionCreateMany).toHaveBeenCalledWith({
      data: [{ asset_id: 'a', event_id: 'e', quantity: '1' }],
      skipDuplicates: true,
    });
  });

  it('SHOULD reject a suggestion with who and when', async () => {
    await setup.rejectSuggestion('sug-1', 'user-1');

    expect(spies.suggestionUpdate).toHaveBeenCalledWith({
      data: expect.objectContaining({ decided_by: 'user-1', status: 'REJECTED' }),
      where: { id: 'sug-1' },
    });
  });

  it('SHOULD upsert every event by its key', async () => {
    spies.eventUpsert.mockResolvedValue({ id: 'ev-1' });

    const events = await setup.upsertEvents([
      {
        amountPerUnit: '0.47',
        currency: 'BRL',
        eventKey: 'brapi:PETR4:DIVIDEND:2026-11-21',
        exDate: '2026-11-21',
        fetchedAt: new Date('2026-11-10T22:00:00Z'),
        market: 'B3' as never,
        paymentDate: null,
        source: 'brapi',
        ticker: 'PETR4',
        type: 'DIVIDEND' as never,
      },
    ]);

    expect(events).toEqual([{ id: 'ev-1' }]);
    expect(spies.eventUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { event_key: 'brapi:PETR4:DIVIDEND:2026-11-21' } }),
    );
  });

  it('SHOULD match assets of the tracked symbols AND read what the matcher needs', async () => {
    spies.assetFindMany.mockResolvedValue([
      { asset_class: 'BR_STOCK', id: 'a1', operations: [], ticker: 'PETR4' },
      { asset_class: 'FOREIGN_STOCK', id: 'a2', operations: [], ticker: 'PETR4' },
      { asset_class: 'BR_REIT', id: 'a3', operations: [], ticker: null },
    ]);
    spies.suggestionFindMany.mockResolvedValue([{ asset_id: 'a1', event_id: 'e1' }]);
    spies.incomeFindMany.mockResolvedValue([]);

    const inputs = await setup.findSuggestionInputs([{ market: 'B3', ticker: 'PETR4' }]);

    expect(inputs.assets.map((asset) => asset.asset_id)).toEqual(['a1']);
    expect(inputs.existing).toEqual([{ asset_id: 'a1', event_id: 'e1' }]);
  });
});

describe('runExclusive', () => {
  it('SHOULD run the callback only when the lock is free', async () => {
    const fn = jest.fn();

    spies.queryRaw.mockResolvedValueOnce([{ locked: false }]);
    expect(await setup.runExclusive(107001, fn)).toBe(false);
    expect(fn).not.toHaveBeenCalled();

    spies.queryRaw.mockResolvedValueOnce([{ locked: true }]);
    expect(await setup.runExclusive(107001, fn)).toBe(true);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
