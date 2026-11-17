import { NotFoundException } from '@nestjs/common';

import { mocks, setup, spies } from './index.mocks';

const series = {
  accountId: 'acc-1',
  amountPerUnit: '1.1',
  assetId: 'asset-1',
  categoryId: 'cat-1',
  createdBy: 'user-1',
  currency: 'BRL',
  endDate: null,
  endedAt: null,
  endReason: null,
  exDateOffsetDays: 8,
  firstNumber: 1,
  firstPaymentDate: '2025-01-15',
  frequency: { interval: 1, unit: 'MONTH' as never },
  lastGeneratedNumber: 2,
  notes: null,
  type: 'YIELD' as never,
  withFinance: true,
};

describe('createSeries', () => {
  it('SHOULD create the series, its finance rows AND move the ledger once with the received sum (spec 115 FR 14-15)', async () => {
    expect(
      await setup.createSeries({ assetLabel: 'HGLG11', occurrences: mocks.occurrences, series }),
    ).toBe('series-1');

    expect(spies.seriesCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        account_id: 'acc-1',
        first_payment_date: new Date('2025-01-15T00:00:00Z'),
        frequency_interval: 1,
        frequency_unit: 'MONTH',
        last_generated_number: 2,
        with_finance: true,
      }),
    });

    const rows = spies.transactionCreateMany.mock.calls[0][0].data;

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      account_id: 'acc-1',
      external_lock: 'INVESTMENT',
      owner: 'USER',
      owner_id: 'owner-1',
      paid: true,
      type: 'INCOME',
      value: 11000,
    });
    expect(rows[1].paid).toBe(false);

    const incomes = spies.incomeCreateMany.mock.calls[0][0].data;

    expect(incomes.map((income: { transaction_id: string }) => income.transaction_id)).toEqual(
      rows.map((row: { id: string }) => row.id),
    );
    expect(incomes[0]).toMatchObject({
      occurrence_number: 1,
      received: true,
      series_id: 'series-1',
    });
    expect(spies.accountUpdate).toHaveBeenCalledTimes(1);
    expect(spies.accountUpdate).toHaveBeenCalledWith({
      data: { ledger_balance: { increment: 11000 } },
      where: { id: 'acc-1' },
    });
  });

  it('SHOULD insert in batches of 500 AND skip the ledger WHEN nothing was received', async () => {
    const many = Array.from({ length: 1200 }, (_, index) => ({
      ...mocks.occurrences[1],
      number: index + 1,
    }));

    await setup.createSeries({ assetLabel: 'HGLG11', occurrences: many, series });

    expect(spies.transactionCreateMany).toHaveBeenCalledTimes(3);
    expect(spies.incomeCreateMany).toHaveBeenCalledTimes(3);
    expect(spies.accountUpdate).not.toHaveBeenCalled();
  });

  it('SHOULD write no finance row for a series without finance', async () => {
    spies.seriesCreate.mockResolvedValue({
      ...mocks.seriesRow,
      account_id: null,
      category_id: null,
      with_finance: false,
    });
    await setup.createSeries({
      assetLabel: 'HGLG11',
      occurrences: mocks.occurrences,
      series: { ...series, accountId: null, categoryId: null, withFinance: false },
    });

    expect(spies.transactionCreateMany).not.toHaveBeenCalled();
    expect(spies.accountUpdate).not.toHaveBeenCalled();
    expect(spies.incomeCreateMany.mock.calls[0][0].data[0].transaction_id).toBeNull();
  });

  it('SHOULD write only the series WHEN there is no occurrence', async () => {
    await setup.createSeries({ assetLabel: 'HGLG11', occurrences: [], series });

    expect(spies.incomeCreateMany).not.toHaveBeenCalled();
  });

  it('SHOULD fail WHEN the account is gone', async () => {
    spies.accountFindUnique.mockResolvedValue(null);

    await expect(
      setup.createSeries({ assetLabel: 'HGLG11', occurrences: mocks.occurrences, series }),
    ).rejects.toThrow('Account not found');
  });
});

describe('materialize (spec 115 FR 18)', () => {
  const params = {
    assetLabel: 'HGLG11',
    lastGeneratedNumber: 25,
    occurrences: [mocks.occurrences[1]],
    seriesId: 'series-1',
  };

  it('SHOULD insert the planned occurrences AND move the cursor under the series lock', async () => {
    spies.seriesFindUnique.mockResolvedValue({ ...mocks.seriesRow, ended_at: null });

    await setup.materialize(params);

    expect(spies.incomeCreateMany).toHaveBeenCalledTimes(1);
    expect(spies.seriesUpdate).toHaveBeenCalledWith({
      data: { last_generated_number: 25 },
      where: { id: 'series-1' },
    });
  });

  it('SHOULD end the series WHEN asked', async () => {
    await setup.materialize({
      ...params,
      ended: { endedAt: '2026-12-15', endReason: 'POSITION_ZERO' as never },
    });

    expect(spies.seriesUpdate).toHaveBeenCalledWith({
      data: {
        end_reason: 'POSITION_ZERO',
        ended_at: new Date('2026-12-15T00:00:00Z'),
        last_generated_number: 25,
      },
      where: { id: 'series-1' },
    });
  });

  it('SHOULD insert nothing twice: a run that already moved the cursor OR ended the series is skipped', async () => {
    spies.seriesFindUnique
      .mockResolvedValueOnce(mocks.seriesRow)
      .mockResolvedValueOnce({ ended_at: null, last_generated_number: 25 });
    await setup.materialize(params);

    spies.seriesFindUnique
      .mockResolvedValueOnce(mocks.seriesRow)
      .mockResolvedValueOnce({ ended_at: new Date(), last_generated_number: 23 });
    await setup.materialize(params);

    spies.seriesFindUnique.mockResolvedValueOnce(null);
    await setup.materialize(params);

    expect(spies.incomeCreateMany).not.toHaveBeenCalled();
  });
});

describe('endSeries / splitSeries / deleteSeries', () => {
  it('SHOULD end the series AND delete the planned occurrences from a number with their unpaid rows', async () => {
    spies.incomeFindMany.mockResolvedValue([
      { id: 'inc-2', transaction_id: 'tx-2' },
      { id: 'inc-3', transaction_id: null },
    ]);

    await setup.endSeries({
      deleteFromNumber: 24,
      endedAt: '2026-11-15',
      endReason: 'MANUAL' as never,
      id: 'series-1',
    });

    expect(spies.incomeFindMany).toHaveBeenCalledWith({
      select: { id: true, transaction_id: true },
      where: { occurrence_number: { gte: 24 }, received: false, series_id: 'series-1' },
    });
    expect(spies.incomeDeleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['inc-2', 'inc-3'] } },
    });
    expect(spies.transactionDeleteMany).toHaveBeenCalledWith({ where: { id: { in: ['tx-2'] } } });
    expect(spies.seriesUpdate).toHaveBeenCalledWith({
      data: { end_reason: 'MANUAL', ended_at: new Date('2026-11-15T00:00:00Z') },
      where: { id: 'series-1' },
    });
  });

  it('SHOULD only end the series WHEN no number is given AND answer 404 for an unknown one', async () => {
    await setup.endSeries({ endedAt: '2026-11-15', endReason: 'MANUAL' as never, id: 'series-1' });

    expect(spies.incomeDeleteMany).not.toHaveBeenCalled();

    spies.seriesFindUnique.mockResolvedValue(null);
    await expect(
      setup.endSeries({ endedAt: '2026-11-15', endReason: 'MANUAL' as never, id: 'x' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      setup.splitSeries({
        create: { assetLabel: 'x', occurrences: [], series },
        deleteFromNumber: 1,
        endedAt: '2026-11-15',
        id: 'x',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('SHOULD end the old series with SPLIT AND create the new one in the same transaction', async () => {
    spies.seriesCreate.mockResolvedValue({ ...mocks.seriesRow, id: 'series-2' });

    expect(
      await setup.splitSeries({
        create: { assetLabel: 'HGLG11', occurrences: [mocks.occurrences[1]], series },
        deleteFromNumber: 24,
        endedAt: '2026-11-15',
        id: 'series-1',
      }),
    ).toBe('series-2');
    expect(spies.seriesUpdate).toHaveBeenCalledWith({
      data: { end_reason: 'SPLIT', ended_at: new Date('2026-11-15T00:00:00Z') },
      where: { id: 'series-1' },
    });
    expect(spies.incomeCreateMany).toHaveBeenCalledTimes(1);
  });

  it('SHOULD delete the whole series AND give back what the received rows added to the ledger', async () => {
    spies.incomeFindMany.mockResolvedValue([
      {
        transaction: { account_id: 'acc-1', paid: true, type: 'INCOME', value: 11000 },
        transaction_id: 'tx-1',
      },
      {
        transaction: { account_id: 'acc-1', paid: false, type: 'INCOME', value: 11000 },
        transaction_id: 'tx-2',
      },
      { transaction: null, transaction_id: null },
    ]);

    await setup.deleteSeries('series-1');

    expect(spies.seriesDelete).toHaveBeenCalledWith({ where: { id: 'series-1' } });
    expect(spies.transactionDeleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['tx-1', 'tx-2'] } },
    });
    expect(spies.accountUpdate).toHaveBeenCalledWith({
      data: { ledger_balance: { increment: -11000 } },
      where: { id: 'acc-1' },
    });

    spies.seriesFindUnique.mockResolvedValue(null);
    await setup.deleteSeries('x');
    expect(spies.seriesDelete).toHaveBeenCalledTimes(1);
  });
});

describe('updateSeries', () => {
  it('SHOULD patch the header AND rewrite the planned occurrences through the income write', async () => {
    spies.incomeFindUnique
      .mockResolvedValueOnce({
        created_by: 'user-1',
        currency: 'BRL',
        id: 'inc-2',
        payment_date: new Date('2026-12-15T00:00:00Z'),
        received: false,
        transaction: { account_id: 'acc-1', paid: false, type: 'INCOME', value: 11000 },
        transaction_id: 'tx-2',
        type: 'YIELD',
      })
      .mockResolvedValueOnce({
        id: 'inc-2',
        transaction: { account_id: 'acc-1', paid: false, type: 'INCOME', value: 11000 },
        transaction_id: 'tx-2',
      })
      .mockResolvedValueOnce({ received: true });
    spies.incomeUpdate.mockResolvedValue({ id: 'inc-2' });

    await setup.updateSeries({
      assetLabel: 'HGLG11',
      patch: {
        accountId: 'acc-1',
        amountPerUnit: '1.5',
        categoryId: 'cat-1',
        endDate: null,
        endedAt: null,
        endReason: null,
        lastGeneratedNumber: 24,
        notes: null,
        withFinance: true,
      },
      planned: [
        {
          amountPerUnit: '1.5',
          exDate: '2026-12-07',
          incomeId: 'inc-2',
          netAmount: 15000,
          quantity: '100',
        },
        {
          amountPerUnit: '1.5',
          exDate: '2026-12-07',
          incomeId: 'inc-3',
          netAmount: 15000,
          quantity: '100',
        },
      ],
      seriesId: 'series-1',
    });

    expect(spies.seriesUpdate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        amount_per_unit: '1.5',
        end_date: null,
        end_reason: null,
        ended_at: null,
        last_generated_number: 24,
        notes: null,
        with_finance: true,
      }),
      where: { id: 'series-1' },
    });
    expect(spies.transactionUpdate).toHaveBeenCalledWith({
      data: expect.objectContaining({ value: 15000 }),
      where: { id: 'tx-2' },
    });
  });

  it('SHOULD answer 404 for an unknown series', async () => {
    spies.seriesFindUnique.mockResolvedValue(null);

    await expect(
      setup.updateSeries({ assetLabel: 'x', patch: {}, seriesId: 'x' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('reads', () => {
  it('SHOULD read series by asset, id, owners AND every active one', async () => {
    spies.seriesFindMany.mockResolvedValue([mocks.seriesRow]);

    expect(await setup.findByAsset('asset-1')).toEqual([mocks.seriesRow]);
    expect(await setup.findAllActive()).toEqual([mocks.seriesRow]);
    expect(
      await setup.findActiveByOwners([{ owner: 'USER' as never, ownerId: 'owner-1' }]),
    ).toEqual([mocks.seriesRow]);
    expect(await setup.findById('series-1')).toBe(mocks.seriesRow);
    expect(spies.seriesFindMany).toHaveBeenCalledWith({
      where: { asset: { OR: [{ owner: 'USER', owner_id: 'owner-1' }] }, ended_at: null },
    });
  });

  it('SHOULD count planned and received occurrences', async () => {
    spies.incomeCount.mockResolvedValueOnce(22).mockResolvedValueOnce(1);

    expect(await setup.countOccurrences('series-1')).toEqual({ planned: 1, received: 22 });
  });

  it('SHOULD list the planned occurrences from a number with their ex-date and quantity', async () => {
    spies.incomeFindMany.mockResolvedValue([
      {
        ex_date: new Date('2026-12-07T00:00:00Z'),
        id: 'inc-2',
        occurrence_number: 24,
        payment_date: new Date('2026-12-15T00:00:00Z'),
        quantity: { toFixed: () => '100.00000000' },
      },
      {
        ex_date: null,
        id: 'inc-3',
        occurrence_number: null,
        payment_date: new Date('2027-01-15T00:00:00Z'),
        quantity: null,
      },
    ]);

    expect(await setup.findPlannedFrom('series-1', 0)).toEqual([
      {
        exDate: '2026-12-07',
        id: 'inc-2',
        number: 24,
        paymentDate: '2026-12-15',
        quantity: '100.00000000',
      },
      { exDate: '2027-01-15', id: 'inc-3', number: 0, paymentDate: '2027-01-15', quantity: '0' },
    ]);
  });
});
