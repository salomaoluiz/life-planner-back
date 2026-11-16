import { NotFoundException } from '@nestjs/common';

import { NegativePositionError } from '@investment/domain/error/NegativePositionError';
import { NoPositionError } from '@investment/domain/error/NoPositionError';

import { mocks, setup, spies } from './index.mocks';

const baseParams = {
  account_id: 'acc-1',
  asset_id: 'asset-1',
  asset_label: 'ITSA4',
  currency: 'BRL',
  date: new Date('2026-06-10T00:00:00Z'),
  fees: [{ amount: 490, description: null, kind: 'BROKERAGE' as const }],
  fees_total: 490,
  fx_rate: null,
  generate_transaction: true,
  gross: 510000,
  quantity: '500.00000000',
  total: 510490,
  type: 'BUY' as const,
  unit_price: '10.20000000',
};

function positionRows(rows: { date: string; id: string; qty: string; type: 'BUY' | 'SELL' }[]) {
  return rows.map((row) => ({
    bonus_percent: null,
    bonus_unit_cost: null,
    created_at: new Date('2026-01-01T00:00:00Z'),
    date: new Date(`${row.date}T00:00:00Z`),
    fraction_of_operation_id: null,
    id: row.id,
    quantity: mocks.decimal(row.qty),
    ratio_from: null,
    ratio_to: null,
    total: 100,
    type: row.type,
  }));
}

describe('reads', () => {
  it('SHOULD delegate the simple reads to Prisma', async () => {
    spies.assetFindMany.mockResolvedValue([]);
    spies.assetFindFirst.mockResolvedValue({ id: 'x' });
    spies.assetFindUnique.mockResolvedValue(null);
    spies.operationFindMany.mockResolvedValue([]);
    spies.operationFindUnique.mockResolvedValue(null);
    spies.valuationFindMany.mockResolvedValue([]);
    spies.valuationFindUnique.mockResolvedValue(null);
    spies.accountFindUnique.mockResolvedValue(null);

    await setup.findAssets([{ owner: 'USER' as never, ownerId: 'u' }], 'ACTIVE');
    expect(spies.assetFindMany).toHaveBeenCalledWith({
      orderBy: [{ asset_class: 'asc' }, { ticker: 'asc' }, { name: 'asc' }],
      where: { OR: [{ owner: 'USER', owner_id: 'u' }], status: 'ACTIVE' },
    });
    expect(await setup.existsByOwner('USER', 'u')).toBe(true);
    expect(await setup.findAssetById('a')).toBeNull();
    await setup.findAssetByTicker('USER', 'u', 'ITSA4');
    await setup.findLatestValuations(['a']);
    expect(spies.valuationFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ distinct: ['asset_id'] }),
    );
    await setup.findOperationsByAssetIds(['a']);
    expect(spies.operationFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ include: { fees: true }, where: { asset_id: { in: ['a'] } } }),
    );
    expect(await setup.findOperationById('o')).toBeNull();
    await setup.findOperationByTransactionId('t');
    expect(spies.operationFindUnique).toHaveBeenCalledWith({
      select: { asset_id: true, id: true },
      where: { transaction_id: 't' },
    });
    expect(await setup.findValuationById('v')).toBeNull();
    await setup.findValuationsByAssetId('a');
    expect(await setup.findAccountById('acc')).toBeNull();
  });

  it('SHOULD report no assets for an owner without rows', async () => {
    spies.assetFindFirst.mockResolvedValue(null);

    expect(await setup.existsByOwner('FAMILY', 'f')).toBe(false);
  });
});

describe('asset writes', () => {
  it('SHOULD create the asset with its first valuation', async () => {
    spies.assetCreate.mockResolvedValue({ id: 'a' });
    const date = new Date('2026-11-09T00:00:00Z');

    await setup.createAsset({
      asset_class: 'BR_STOCK',
      currency: 'BRL',
      name: 'Itausa',
      owner: 'USER',
      owner_id: 'u',
      ticker: 'ITSA4',
      valuation: { date, unit_price: '10.53000000' },
    });

    expect(spies.assetCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        valuations: { create: { date, unit_price: '10.53000000' } },
      }),
    });
  });

  it('SHOULD create the asset without valuation', async () => {
    spies.assetCreate.mockResolvedValue({ id: 'a' });

    await setup.createAsset({
      asset_class: 'PRIVATE',
      currency: 'BRL',
      name: 'Options',
      owner: 'USER',
      owner_id: 'u',
      ticker: null,
    });

    expect(spies.assetCreate.mock.calls[0][0].data).not.toHaveProperty('valuations');
  });

  it('SHOULD update only the given columns', async () => {
    spies.assetUpdate.mockResolvedValue({ id: 'a' });

    await setup.updateAsset({ id: 'a', name: 'New' });

    expect(spies.assetUpdate).toHaveBeenCalledWith({ data: { name: 'New' }, where: { id: 'a' } });
  });

  it('SHOULD upsert a valuation by asset and date', async () => {
    const date = new Date('2026-11-01T00:00:00Z');

    await setup.upsertValuation('a', date, '10.61000000');

    expect(spies.valuationUpsert).toHaveBeenCalledWith({
      create: { asset_id: 'a', date, unit_price: '10.61000000' },
      update: { unit_price: '10.61000000' },
      where: { asset_id_date: { asset_id: 'a', date } },
    });
  });

  it('SHOULD delete a valuation tolerating a missing row', async () => {
    await setup.deleteValuation('v');

    expect(spies.valuationDeleteMany).toHaveBeenCalledWith({ where: { id: 'v' } });
  });
});

describe('deleteAsset', () => {
  it('SHOULD delete the linked rows AND give the balances back before removing the asset', async () => {
    spies.operationFindMany.mockResolvedValue([
      { transaction: { account_id: 'acc-1', type: 'EXPENSE', value: 500 }, transaction_id: 't1' },
      { transaction: { account_id: 'acc-1', type: 'INCOME', value: 200 }, transaction_id: 't2' },
    ]);

    await setup.deleteAsset('asset-1');

    expect(spies.transactionDeleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['t1', 't2'] } },
    });
    expect(spies.accountUpdate).toHaveBeenCalledWith({
      data: { ledger_balance: { increment: 300 } },
      where: { id: 'acc-1' },
    });
    expect(spies.assetDeleteMany).toHaveBeenCalledWith({ where: { id: { in: ['asset-1'] } } });
  });

  it('SHOULD delete the rows of the incomes too AND give back only the received ones', async () => {
    spies.operationFindMany.mockResolvedValue([]);
    spies.incomeFindMany.mockResolvedValue([
      {
        transaction: { account_id: 'acc-1', paid: true, type: 'INCOME', value: 700 },
        transaction_id: 't1',
      },
      {
        transaction: { account_id: 'acc-1', paid: false, type: 'INCOME', value: 900 },
        transaction_id: 't2',
      },
    ]);

    await setup.deleteAsset('asset-1');

    expect(spies.transactionDeleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['t1', 't2'] } },
    });
    expect(spies.accountUpdate).toHaveBeenCalledWith({
      data: { ledger_balance: { increment: -700 } },
      where: { id: 'acc-1' },
    });
    expect(spies.accountUpdate).toHaveBeenCalledTimes(1);
  });

  it('SHOULD only delete the asset WHEN no operation is linked', async () => {
    spies.operationFindMany.mockResolvedValue([]);

    await setup.deleteAsset('asset-1');

    expect(spies.transactionDeleteMany).not.toHaveBeenCalled();
    expect(spies.accountUpdate).not.toHaveBeenCalled();
    expect(spies.assetDeleteMany).toHaveBeenCalled();
  });

  it('SHOULD ignore a linked row without account', async () => {
    spies.operationFindMany.mockResolvedValue([
      { transaction: { account_id: null, type: 'EXPENSE', value: 1 }, transaction_id: 't1' },
    ]);

    await setup.deleteAsset('asset-1');

    expect(spies.accountUpdate).not.toHaveBeenCalled();
  });
});

describe('deleteAssetsByOwner', () => {
  it('SHOULD delete every asset of the owner AND count them', async () => {
    spies.assetFindMany.mockResolvedValue([{ id: 'b' }, { id: 'a' }]);
    spies.operationFindMany.mockResolvedValue([]);

    expect(await setup.deleteAssetsByOwner('USER', 'u')).toBe(2);
    expect(spies.assetDeleteMany).toHaveBeenCalledWith({ where: { id: { in: ['b', 'a'] } } });
  });

  it('SHOULD do nothing for an owner without assets', async () => {
    spies.assetFindMany.mockResolvedValue([]);

    expect(await setup.deleteAssetsByOwner('USER', 'u')).toBe(0);
    expect(spies.assetDeleteMany).not.toHaveBeenCalled();
  });
});

describe('writeOperation', () => {
  beforeEach(() => {
    spies.operationCreate.mockResolvedValue({ id: 'op-1', transaction_id: null });
    spies.accountFindUnique.mockResolvedValue({ owner: 'USER', owner_id: 'owner-1' });
    spies.transactionCreate.mockResolvedValue({ id: 'tx-1' });
    spies.operationFindMany.mockResolvedValue(
      positionRows([{ date: '2026-06-10', id: 'op-1', qty: '500', type: 'BUY' }]),
    );
  });

  it('SHOULD create the operation, one paid EXPENSE row AND take the total out of the account', async () => {
    expect(await setup.writeOperation(baseParams)).toBe('op-1');

    expect(spies.transactionCreate).toHaveBeenCalledWith({
      data: {
        account_id: 'acc-1',
        category_id: '00000000-0000-4000-8000-000000000009',
        currency: 'BRL',
        date: baseParams.date,
        description: 'ITSA4',
        owner: 'USER',
        owner_id: 'owner-1',
        paid: true,
        type: 'EXPENSE',
        value: 510490,
      },
    });
    expect(spies.operationUpdate).toHaveBeenCalledWith({
      data: { transaction_id: 'tx-1' },
      where: { id: 'op-1' },
    });
    expect(spies.accountUpdate).toHaveBeenCalledWith({
      data: { ledger_balance: { increment: -510490 } },
      where: { id: 'acc-1' },
    });
  });

  it('SHOULD write an INCOME redemption row for a sell', async () => {
    await setup.writeOperation({ ...baseParams, type: 'SELL' });

    expect(spies.transactionCreate.mock.calls[0][0].data).toMatchObject({
      category_id: '00000000-0000-4000-8000-00000000000a',
      type: 'INCOME',
    });
    expect(spies.accountUpdate).toHaveBeenCalledWith({
      data: { ledger_balance: { increment: 510490 } },
      where: { id: 'acc-1' },
    });
  });

  it('SHOULD write no finance row WHEN generate_transaction is off', async () => {
    await setup.writeOperation({ ...baseParams, account_id: null, generate_transaction: false });

    expect(spies.transactionCreate).not.toHaveBeenCalled();
    expect(spies.accountUpdate).not.toHaveBeenCalled();
    expect(spies.operationCreate.mock.calls[0][0].data.account_id).toBeNull();
  });

  it('SHOULD update the row AND move only the difference WHEN editing', async () => {
    spies.operationFindUnique.mockResolvedValue({
      account_id: 'acc-1',
      asset_id: 'asset-1',
      id: 'op-1',
      transaction: { account_id: 'acc-1', type: 'EXPENSE', value: 500000 },
      transaction_id: 'tx-1',
    });
    spies.operationUpdate.mockResolvedValue({ id: 'op-1', transaction_id: 'tx-1' });

    await setup.writeOperation({ ...baseParams, operation_id: 'op-1' });

    expect(spies.transactionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'tx-1' } }),
    );
    expect(spies.transactionCreate).not.toHaveBeenCalled();
    expect(spies.accountUpdate).toHaveBeenCalledWith({
      data: { ledger_balance: { increment: -10490 } },
      where: { id: 'acc-1' },
    });
  });

  it('SHOULD delete the row AND restore the balance WHEN generate_transaction is turned off', async () => {
    spies.operationFindUnique.mockResolvedValue({
      account_id: 'acc-1',
      asset_id: 'asset-1',
      id: 'op-1',
      transaction: { account_id: 'acc-1', type: 'EXPENSE', value: 500000 },
      transaction_id: 'tx-1',
    });
    spies.operationUpdate.mockResolvedValue({ id: 'op-1', transaction_id: 'tx-1' });

    await setup.writeOperation({
      ...baseParams,
      account_id: null,
      generate_transaction: false,
      operation_id: 'op-1',
    });

    expect(spies.transactionDelete).toHaveBeenCalledWith({ where: { id: 'tx-1' } });
    expect(spies.operationUpdate).toHaveBeenLastCalledWith({
      data: { transaction_id: null },
      where: { id: 'op-1' },
    });
    expect(spies.accountUpdate).toHaveBeenCalledWith({
      data: { ledger_balance: { increment: 500000 } },
      where: { id: 'acc-1' },
    });
  });

  it('SHOULD fail WHEN the edited operation does not exist', async () => {
    spies.operationFindUnique.mockResolvedValue(null);

    await expect(setup.writeOperation({ ...baseParams, operation_id: 'missing' })).rejects.toThrow(
      NotFoundException,
    );
  });

  it('SHOULD fail WHEN the account does not exist', async () => {
    spies.accountFindUnique.mockResolvedValue(null);

    await expect(setup.writeOperation(baseParams)).rejects.toThrow(NotFoundException);
  });

  it('SHOULD throw the negative position WHEN a sell exceeds what was held', async () => {
    spies.operationFindMany.mockResolvedValue(
      positionRows([
        { date: '2026-06-10', id: 'op-1', qty: '500', type: 'BUY' },
        { date: '2026-09-15', id: 'op-2', qty: '600', type: 'SELL' },
      ]),
    );

    await expect(setup.writeOperation(baseParams)).rejects.toEqual(
      new NegativePositionError('2026-09-15', 'op-2'),
    );
  });
});

describe('deleteOperation', () => {
  it('SHOULD delete the operation AND its row AND give the balance back', async () => {
    spies.operationFindUnique.mockResolvedValue({
      account_id: 'acc-1',
      asset_id: 'asset-1',
      id: 'op-1',
      transaction: { account_id: 'acc-1', type: 'INCOME', value: 700 },
      transaction_id: 'tx-1',
    });
    spies.operationFindMany.mockResolvedValue([]);

    await setup.deleteOperation('op-1');

    expect(spies.operationDelete).toHaveBeenCalledWith({ where: { id: 'op-1' } });
    expect(spies.transactionDelete).toHaveBeenCalledWith({ where: { id: 'tx-1' } });
    expect(spies.accountUpdate).toHaveBeenCalledWith({
      data: { ledger_balance: { increment: -700 } },
      where: { id: 'acc-1' },
    });
  });

  it('SHOULD do nothing for a missing operation', async () => {
    spies.operationFindUnique.mockResolvedValue(null);

    await setup.deleteOperation('op-1');

    expect(spies.operationDelete).not.toHaveBeenCalled();
  });

  it('SHOULD refuse AND roll back WHEN a later sell depended on the operation', async () => {
    spies.operationFindUnique.mockResolvedValue({
      account_id: null,
      asset_id: 'asset-1',
      id: 'op-1',
      transaction: null,
      transaction_id: null,
    });
    spies.operationFindMany.mockResolvedValue(
      positionRows([{ date: '2026-09-15', id: 'op-2', qty: '10', type: 'SELL' }]),
    );

    await expect(setup.deleteOperation('op-1')).rejects.toBeInstanceOf(NegativePositionError);
  });

  it('SHOULD take the fraction sale, its row AND its ledger with a deleted event AND dismiss the suggestion', async () => {
    spies.operationFindUnique
      .mockResolvedValueOnce({
        account_id: null,
        asset_id: 'asset-1',
        event_suggestion_id: 'sug-1',
        id: 'event-1',
        transaction: null,
        transaction_id: null,
      })
      .mockResolvedValueOnce({
        account_id: 'acc-1',
        asset_id: 'asset-1',
        id: 'sale-1',
        transaction: { account_id: 'acc-1', type: 'INCOME', value: 520 },
        transaction_id: 'tx-1',
      });
    spies.operationFindMany.mockResolvedValue([]);

    await setup.deleteOperation('event-1');

    expect(spies.eventSuggestionUpdate).toHaveBeenCalledWith({
      data: { status: 'DISMISSED' },
      where: { id: 'sug-1' },
    });
    expect(spies.operationDelete).toHaveBeenCalledWith({ where: { id: 'sale-1' } });
    expect(spies.operationDelete).toHaveBeenCalledWith({ where: { id: 'event-1' } });
    expect(spies.transactionDelete).toHaveBeenCalledWith({ where: { id: 'tx-1' } });
    expect(spies.accountUpdate).toHaveBeenCalledWith({
      data: { ledger_balance: { increment: -520 } },
      where: { id: 'acc-1' },
    });
  });
});

describe('writeEvent', () => {
  const event = {
    asset_id: 'asset-1',
    bonus_percent: null,
    bonus_unit_cost: null,
    date: new Date('2026-03-10T00:00:00Z'),
    ratio_from: '10',
    ratio_to: '1',
    type: 'REVERSE_SPLIT' as const,
  };

  it('SHOULD create the event without any money field or finance row', async () => {
    spies.operationCreate.mockResolvedValue({ id: 'event-1' });
    spies.operationFindMany.mockResolvedValue(
      positionRows([{ date: '2026-01-10', id: 'b', qty: '3155', type: 'BUY' }]),
    );

    await expect(setup.writeEvent(event)).resolves.toBe('event-1');

    expect(spies.operationCreate).toHaveBeenCalledWith({
      data: {
        asset_id: 'asset-1',
        bonus_percent: null,
        bonus_unit_cost: null,
        date: event.date,
        event_suggestion_id: null,
        generate_transaction: false,
        ratio_from: '10',
        ratio_to: '1',
        type: 'REVERSE_SPLIT',
      },
    });
    expect(spies.transactionCreate).not.toHaveBeenCalled();
  });

  it('SHOULD mark the suggestion approved in the same transaction', async () => {
    spies.operationCreate.mockResolvedValue({ id: 'event-1' });
    spies.operationFindMany.mockResolvedValue(
      positionRows([{ date: '2026-01-10', id: 'b', qty: '3155', type: 'BUY' }]),
    );

    await setup.writeEvent({ ...event, decided_by: 'user-1', event_suggestion_id: 'sug-1' });

    expect(spies.eventSuggestionUpdate).toHaveBeenCalledWith({
      data: { decided_at: expect.any(Date), decided_by: 'user-1', status: 'APPROVED' },
      where: { id: 'sug-1' },
    });
  });

  it('SHOULD update the fields of an existing event', async () => {
    spies.operationFindUnique.mockResolvedValue({ id: 'event-1' });
    spies.operationUpdate.mockResolvedValue({ id: 'event-1' });
    spies.operationFindMany.mockResolvedValue(
      positionRows([{ date: '2026-01-10', id: 'b', qty: '3155', type: 'BUY' }]),
    );

    await setup.writeEvent({ ...event, operation_id: 'event-1' });

    expect(spies.operationUpdate).toHaveBeenCalledWith({
      data: {
        bonus_percent: null,
        bonus_unit_cost: null,
        date: event.date,
        ratio_from: '10',
        ratio_to: '1',
      },
      where: { id: 'event-1' },
    });
  });

  it('SHOULD answer not found for an event that does not exist', async () => {
    spies.operationFindUnique.mockResolvedValue(null);

    await expect(setup.writeEvent({ ...event, operation_id: 'missing' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('SHOULD refuse an event dated where no shares are held', async () => {
    spies.operationCreate.mockResolvedValue({ id: 'event-1' });
    spies.operationFindMany.mockResolvedValue([
      {
        ...positionRows([{ date: '2026-03-10', id: 'event-1', qty: '0', type: 'BUY' }])[0],
        quantity: null,
        ratio_from: mocks.decimal('10'),
        ratio_to: mocks.decimal('1'),
        total: null,
        type: 'REVERSE_SPLIT',
      },
    ]);

    await expect(setup.writeEvent(event)).rejects.toBeInstanceOf(NoPositionError);
  });
});

describe('fraction sale', () => {
  it('SHOULD store the link to its event on a new SELL', async () => {
    spies.operationCreate.mockResolvedValue({ id: 'sale-1', transaction_id: null });
    spies.accountFindUnique.mockResolvedValue({ owner: 'USER', owner_id: 'u' });
    spies.transactionCreate.mockResolvedValue({ id: 'tx-1' });
    spies.operationFindMany.mockResolvedValue(
      positionRows([{ date: '2026-01-10', id: 'b', qty: '3155', type: 'BUY' }]),
    );

    await setup.writeOperation({
      ...baseParams,
      fraction_of_operation_id: 'event-1',
      type: 'SELL',
    });

    expect(spies.operationCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ fraction_of_operation_id: 'event-1', type: 'SELL' }),
    });
  });
});

describe('fixed income', () => {
  const rate = {
    annualRate: '12',
    cdiPercent: null,
    effectiveRate: '12.000000',
    indexRate: null,
    mode: 'PREFIXED' as never,
    spread: null,
    startDate: '2026-01-02',
  };
  const terms = {
    liquidity: 'DAILY' as never,
    liquidityDate: null,
    maturityDate: '2030-01-02',
    product: 'CDB' as never,
    taxExempt: false,
  };

  it('SHOULD lock the asset, write the rate AND recalculate', async () => {
    spies.termsFindUnique.mockResolvedValue(null);

    await setup.createFixedIncomeRate('asset-1', rate);
    await setup.updateFixedIncomeRate('asset-1', 'rate-1', rate);
    await setup.deleteFixedIncomeRate('asset-1', 'rate-1');
    await setup.upsertFixedIncomeAdjustment('asset-1', '2026-07-01', 1_100_000);
    await setup.deleteFixedIncomeAdjustment('asset-1', 'adj-1');

    expect(spies.rateCreate).toHaveBeenCalledTimes(1);
    expect(spies.rateUpdate).toHaveBeenCalledTimes(1);
    expect(spies.rateDeleteMany).toHaveBeenCalledTimes(1);
    expect(spies.adjustmentUpsert).toHaveBeenCalledTimes(1);
    expect(spies.adjustmentDeleteMany).toHaveBeenCalledTimes(1);
    expect(spies.queryRaw).toHaveBeenCalledTimes(5);
    expect(spies.termsFindUnique).toHaveBeenCalledTimes(5);
  });

  it('SHOULD save the terms with the first rate AND convert a manual asset', async () => {
    spies.termsFindUnique.mockResolvedValue(null);
    spies.operationFindMany.mockResolvedValue([]);

    await setup.saveFixedIncomeTerms({ assetId: 'asset-1', convert: true, rate, terms });

    expect(spies.valuationDeleteMany).toHaveBeenCalledWith({ where: { asset_id: 'asset-1' } });
    expect(spies.termsUpsert).toHaveBeenCalledTimes(1);
    expect(spies.rateCreate).toHaveBeenCalledTimes(1);
  });

  it('SHOULD save only the terms WHEN editing', async () => {
    spies.termsFindUnique.mockResolvedValue(null);

    await setup.saveFixedIncomeTerms({ assetId: 'asset-1', convert: false, terms });

    expect(spies.valuationDeleteMany).not.toHaveBeenCalled();
    expect(spies.rateCreate).not.toHaveBeenCalled();
  });

  it('SHOULD create the asset, its terms, its first rate AND its contribution together', async () => {
    spies.assetCreate.mockResolvedValue({ id: 'asset-9' });
    spies.operationCreate.mockResolvedValue({ id: 'op-1', transaction_id: null });
    spies.operationFindMany.mockResolvedValue([]);
    spies.termsFindUnique.mockResolvedValue(null);

    const result = await setup.createFixedIncomeTitle({
      asset: {
        asset_class: 'FIXED_INCOME',
        currency: 'BRL',
        name: 'CDB',
        owner: 'USER',
        owner_id: 'u',
        ticker: null,
        valuation: { date: new Date(), unit_price: '1' },
      },
      contribution: {
        account_id: null,
        asset_label: 'CDB',
        currency: 'BRL',
        date: baseParams.date,
        fees: [],
        fees_total: 0,
        fx_rate: null,
        generate_transaction: false,
        gross: 100,
        quantity: '1.00000000',
        total: 100,
        type: 'BUY',
        unit_price: '1.00000000',
      },
      rate,
      terms,
    });

    expect(result).toEqual({ assetId: 'asset-9', operationId: 'op-1' });
    expect(spies.assetCreate).toHaveBeenCalledWith({
      data: expect.not.objectContaining({ valuation: expect.anything() }),
    });
    expect(spies.termsUpsert).toHaveBeenCalledTimes(1);
    expect(spies.rateCreate).toHaveBeenCalledTimes(1);
  });

  it('SHOULD read the rows of the titles in three queries', async () => {
    spies.termsFindMany.mockResolvedValue([{ asset_id: 'a' }]);
    spies.rateFindMany.mockResolvedValue([]);
    spies.adjustmentFindMany.mockResolvedValue([]);
    spies.rateFindUnique.mockResolvedValue({ id: 'r' });
    spies.adjustmentFindUnique.mockResolvedValue({ id: 'adj' });

    expect(await setup.findFixedIncomeByAssetIds(['a'])).toEqual({
      adjustments: [],
      rates: [],
      terms: [{ asset_id: 'a' }],
    });
    expect(await setup.findFixedIncomeRateById('r')).toEqual({ id: 'r' });
    expect(await setup.findFixedIncomeAdjustmentById('adj')).toEqual({ id: 'adj' });
  });
});

describe('dashboard reads (spec 110)', () => {
  it('SHOULD read every valuation of the assets in ONE query, oldest first', async () => {
    spies.valuationFindMany.mockResolvedValue([{ id: 'v' }]);

    expect(await setup.findValuationsByAssetIds(['a', 'b'])).toEqual([{ id: 'v' }]);
    expect(spies.valuationFindMany).toHaveBeenCalledTimes(1);
    expect(spies.valuationFindMany).toHaveBeenCalledWith({
      orderBy: [{ date: 'asc' }],
      where: { asset_id: { in: ['a', 'b'] } },
    });
  });

  it('SHOULD skip the query WHEN there are no assets', async () => {
    expect(await setup.findValuationsByAssetIds([])).toEqual([]);
    expect(spies.valuationFindMany).not.toHaveBeenCalled();
  });
});

describe('conversions (spec 112)', () => {
  const date = new Date('2026-10-15T00:00:00Z');
  const params = {
    account_id: null,
    asset_label: 'BCFF11',
    cash_amount: null,
    cash_reference_unit_value: null,
    currency: 'BRL',
    date,
    destination: { asset_id: 'to-1' },
    from_asset_id: 'from-1',
    generate_transaction: false,
    ratio_from: '1',
    ratio_to: '7.4',
  };

  function row(overrides: Record<string, unknown>) {
    return {
      bonus_percent: null,
      bonus_unit_cost: null,
      cash_cost: null,
      conversion_cost: null,
      created_at: new Date('2026-01-01T00:00:00Z'),
      date: new Date('2026-06-10T00:00:00Z'),
      fraction_cost: null,
      fraction_of_operation_id: null,
      fraction_quantity: null,
      id: 'row',
      quantity: mocks.decimal('0'),
      ratio_from: null,
      ratio_to: null,
      total: 0,
      type: 'BUY',
      ...overrides,
    };
  }

  const originBuy = row({ id: 'buy', quantity: mocks.decimal('103'), total: 808550 });
  const outRow = row({
    conversion_cost: 808550,
    date,
    id: 'out',
    quantity: mocks.decimal('103'),
    type: 'CONVERSION_OUT',
  });
  const inRow = row({
    conversion_cost: 808550,
    date,
    fraction_cost: 212,
    fraction_quantity: mocks.decimal('0.2'),
    id: 'in',
    quantity: mocks.decimal('762'),
    type: 'CONVERSION_IN',
  });

  beforeEach(() => {
    spies.assetFindUnique.mockResolvedValue({ asset_class: 'BR_REIT', ticker: 'BCFF11' });
    spies.conversionCreate.mockResolvedValue({ id: 'conv-1' });
    spies.conversionUpdate.mockResolvedValue({ id: 'conv-1' });
    spies.operationCreate.mockResolvedValue({ id: 'out' });
    spies.operationUpdate.mockResolvedValue({ id: 'out' });
    spies.operationFindMany.mockImplementation(
      async ({ where }: { where: { asset_id: string } }) =>
        where.asset_id === 'from-1' ? [originBuy, outRow] : [inRow],
    );
    // the origin read BEFORE the conversion exists has no OUT yet
    spies.operationFindMany.mockResolvedValueOnce([originBuy]);
  });

  it('SHOULD write both operations with the stored snapshot AND archive the origin', async () => {
    await expect(setup.writeConversion(params)).resolves.toBe('conv-1');

    expect(spies.conversionCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ from_asset_id: 'from-1', to_asset_id: 'to-1' }),
    });
    expect(spies.operationCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        asset_id: 'from-1',
        cash_cost: null,
        conversion_cost: 808550,
        quantity: '103.00000000',
        type: 'CONVERSION_OUT',
      }),
    });
    expect(spies.operationCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        asset_id: 'to-1',
        conversion_cost: 808550,
        fraction_cost: 212,
        fraction_quantity: '0.20000000',
        quantity: '762.00000000',
        type: 'CONVERSION_IN',
      }),
    });
    expect(spies.assetUpdate).toHaveBeenCalledWith({
      data: { archived_at: expect.any(Date), status: 'ARCHIVED' },
      where: { id: 'from-1' },
    });
    expect(spies.suggestionUpdateMany).toHaveBeenCalled();
    expect(spies.eventSuggestionUpdateMany).toHaveBeenCalled();
    expect(spies.transactionCreate).not.toHaveBeenCalled();
  });

  it('SHOULD lock both assets in id order', async () => {
    await setup.writeConversion(params);

    const sql = spies.queryRaw.mock.calls.map((call) => JSON.stringify(call[0].values));

    expect(sql.slice(0, 2)).toEqual([JSON.stringify(['from-1']), JSON.stringify(['to-1'])]);
  });

  it('SHOULD create the destination asset inside the same transaction', async () => {
    spies.assetCreate.mockResolvedValue({ id: 'new-1' });

    await setup.writeConversion({
      ...params,
      destination: {
        new_asset: {
          asset_class: 'BR_REIT',
          currency: 'BRL',
          name: 'Fundo Exemplo',
          owner: 'USER',
          owner_id: 'owner-1',
          ticker: 'XPTO11',
        },
      },
    });

    expect(spies.assetCreate).toHaveBeenCalled();
    expect(spies.conversionCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ to_asset_id: 'new-1' }),
    });
  });

  it('SHOULD write the cash row AND move the ledger WHEN there is a cash part', async () => {
    spies.accountFindUnique.mockResolvedValue({ owner: 'USER', owner_id: 'owner-1' });
    spies.transactionCreate.mockResolvedValue({ id: 'tx-1' });

    await setup.writeConversion({
      ...params,
      account_id: 'acc-1',
      cash_amount: 1500,
      cash_reference_unit_value: '10.4',
      generate_transaction: true,
    });

    expect(spies.operationCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        account_id: 'acc-1',
        cash_cost: 1527,
        gross: 1500,
        total: 1500,
        type: 'CONVERSION_OUT',
      }),
    });
    expect(spies.transactionCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        category_id: '00000000-0000-4000-8000-00000000000a',
        paid: true,
        type: 'INCOME',
        value: 1500,
      }),
    });
    expect(spies.accountUpdate).toHaveBeenCalledWith({
      data: { ledger_balance: { increment: 1500 } },
      where: { id: 'acc-1' },
    });
  });

  it('SHOULD refuse AND list the operations dated after the record date', async () => {
    spies.operationFindMany.mockReset();
    spies.operationFindMany.mockResolvedValue([
      originBuy,
      row({ date: new Date('2026-11-01T00:00:00Z'), id: 'late', quantity: mocks.decimal('3') }),
    ]);

    await expect(setup.writeConversion(params)).rejects.toMatchObject({
      date: '2026-10-15',
      operations: [{ date: '2026-11-01', id: 'late', type: 'BUY' }],
    });
    expect(spies.operationCreate).not.toHaveBeenCalled();
  });

  it('SHOULD refuse a conversion WHEN the origin holds nothing on the date', async () => {
    spies.operationFindMany.mockReset();
    spies.operationFindMany.mockResolvedValue([]);

    await expect(setup.writeConversion(params)).rejects.toBeInstanceOf(NoPositionError);
  });

  it('SHOULD rewrite the snapshot in place AND keep the archive WHEN editing', async () => {
    spies.conversionFindUnique.mockResolvedValue({
      from_asset_id: 'from-1',
      id: 'conv-1',
      operations: [
        {
          account_id: null,
          id: 'out',
          transaction: null,
          transaction_id: null,
          type: 'CONVERSION_OUT',
        },
        {
          account_id: null,
          id: 'in',
          transaction: null,
          transaction_id: null,
          type: 'CONVERSION_IN',
        },
      ],
      to_asset_id: 'to-1',
    });
    spies.operationFindMany.mockReset();
    spies.operationFindMany.mockImplementation(
      async ({ where }: { where: { asset_id: string; id?: unknown } }) => {
        if (where.asset_id === 'from-1') {
          // the edit reads the origin without its own CONVERSION_OUT
          return where.id ? [originBuy] : [originBuy, outRow];
        }

        return [inRow];
      },
    );

    await setup.writeConversion({ ...params, conversion_id: 'conv-1', ratio_to: '2' });

    expect(spies.operationUpdate).toHaveBeenCalledWith({
      data: expect.objectContaining({ quantity: '103.00000000' }),
      where: { id: 'out' },
    });
    expect(spies.operationUpdate).toHaveBeenCalledWith({
      data: expect.objectContaining({ quantity: '206.00000000' }),
      where: { id: 'in' },
    });
    expect(spies.operationCreate).not.toHaveBeenCalled();
    expect(spies.assetUpdate).not.toHaveBeenCalled();
  });

  it('SHOULD fail WHEN the edited conversion does not exist', async () => {
    spies.conversionFindUnique.mockResolvedValue(null);

    await expect(
      setup.writeConversion({ ...params, conversion_id: 'missing' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('SHOULD delete both operations, the fraction sale AND the cash row, then reactivate the origin', async () => {
    spies.conversionFindUnique.mockResolvedValue({
      from_asset_id: 'from-1',
      id: 'conv-1',
      operations: [
        {
          account_id: 'acc-1',
          id: 'out',
          transaction: { account_id: 'acc-1', paid: true, type: 'INCOME', value: 1500 },
          transaction_id: 'tx-out',
          type: 'CONVERSION_OUT',
        },
        {
          account_id: null,
          id: 'in',
          transaction: null,
          transaction_id: null,
          type: 'CONVERSION_IN',
        },
      ],
      to_asset_id: 'to-1',
    });
    spies.operationFindUnique.mockResolvedValue({
      account_id: 'acc-1',
      id: 'sale',
      transaction: { account_id: 'acc-1', paid: true, type: 'INCOME', value: 230 },
      transaction_id: 'tx-sale',
    });
    spies.operationFindMany.mockReset();
    spies.operationFindMany.mockResolvedValue([originBuy]);

    await setup.deleteConversion('conv-1');

    expect(spies.operationDelete.mock.calls.map((call) => call[0].where.id)).toEqual([
      'sale',
      'out',
      'in',
    ]);
    expect(spies.transactionDelete).toHaveBeenCalledWith({ where: { id: 'tx-sale' } });
    expect(spies.transactionDelete).toHaveBeenCalledWith({ where: { id: 'tx-out' } });
    expect(spies.accountUpdate).toHaveBeenCalledWith({
      data: { ledger_balance: { increment: -230 } },
      where: { id: 'acc-1' },
    });
    expect(spies.accountUpdate).toHaveBeenCalledWith({
      data: { ledger_balance: { increment: -1500 } },
      where: { id: 'acc-1' },
    });
    expect(spies.conversionDelete).toHaveBeenCalledWith({ where: { id: 'conv-1' } });
    expect(spies.assetUpdate).toHaveBeenCalledWith({
      data: { archived_at: null, status: 'ACTIVE' },
      where: { id: 'from-1' },
    });
  });

  it('SHOULD do nothing WHEN the conversion to delete is missing', async () => {
    spies.conversionFindUnique.mockResolvedValue(null);

    await setup.deleteConversion('missing');

    expect(spies.operationDelete).not.toHaveBeenCalled();
  });

  it('SHOULD read a conversion AND the conversions of some assets with both tickers', async () => {
    spies.conversionFindUnique.mockResolvedValue(null);
    spies.conversionFindMany.mockResolvedValue([]);

    await expect(setup.findConversionById('c')).resolves.toBeNull();
    await setup.findConversionsByAssetIds(['a', 'b']);

    expect(spies.conversionFindMany).toHaveBeenCalledWith({
      include: {
        from: { select: { ticker: true } },
        to: { select: { conversion_out: { select: { id: true } }, ticker: true } },
      },
      where: { OR: [{ from_asset_id: { in: ['a', 'b'] } }, { to_asset_id: { in: ['a', 'b'] } }] },
    });
  });
});
