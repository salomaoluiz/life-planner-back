import { SYSTEM_CATEGORY_IDS } from '@finance/domain/entity/SystemCategory';
import { SystemCategoryKey } from '@finance/domain/enum';

import { mocks, setup, spies } from './index.mocks';

const OUT = SYSTEM_CATEGORY_IDS[SystemCategoryKey.TRANSFER_OUT];
const IN = SYSTEM_CATEGORY_IDS[SystemCategoryKey.TRANSFER_IN];
const FEE = SYSTEM_CATEGORY_IDS[SystemCategoryKey.TRANSFER_FEE];

function createdRow(args: {
  data: { account_id: string; paid: boolean; type: string; value: number };
}) {
  return Promise.resolve({ ...args.data, id: 'row' });
}

describe('Method create', () => {
  beforeEach(() => {
    spies.transferCreate.mockResolvedValue({ id: 'transfer-1' });
    spies.transactionCreate.mockImplementation(createdRow);
  });

  it('SHOULD lock both accounts, write out, in and fee rows AND move both ledgers WHEN paid', async () => {
    expect(await setup.create(mocks.writeParams)).toEqual(mocks.transferRecord);

    expect(spies.queryRaw).toHaveBeenCalledTimes(1);
    expect(spies.transactionCreate).toHaveBeenCalledTimes(3);
    expect(spies.transactionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          account_id: 'acc-b',
          category_id: OUT,
          currency: 'BRL',
          owner: 'USER',
          paid: true,
          transfer_id: 'transfer-1',
          type: 'EXPENSE',
          value: 500000,
        }),
      }),
    );
    expect(spies.transactionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          account_id: 'acc-a',
          category_id: IN,
          date: mocks.writeParams.date_in,
          owner: 'FAMILY',
          type: 'INCOME',
          value: 92000,
        }),
      }),
    );
    expect(spies.transactionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          account_id: 'acc-a',
          category_id: FEE,
          date: mocks.writeParams.date_in,
          type: 'EXPENSE',
          value: 350,
        }),
      }),
    );
    // acc-a: +92000 - 350, acc-b: -500000, applied in ascending account id order.
    expect(spies.accountUpdate.mock.calls).toEqual([
      [{ data: { ledger_balance: { increment: 91650 } }, where: { id: 'acc-a' } }],
      [{ data: { ledger_balance: { increment: -500000 } }, where: { id: 'acc-b' } }],
    ]);
  });

  it('SHOULD leave the ledgers alone WHEN the transfer is not paid', async () => {
    await setup.create({ ...mocks.writeParams, paid: false });

    expect(spies.accountUpdate).not.toHaveBeenCalled();
  });

  it('SHOULD write no in row WHEN the amount in is unknown AND no fee row WHEN there is no fee', async () => {
    await setup.create({ ...mocks.writeParams, amount_in: null, fee: null, paid: false });

    expect(spies.transactionCreate).toHaveBeenCalledTimes(1);
    expect(spies.transactionCreate.mock.calls[0][0].data.category_id).toBe(OUT);
  });
});

describe('Method update', () => {
  const rows = [
    {
      account_id: 'acc-b',
      category_id: OUT,
      id: 'row-out',
      paid: true,
      type: 'EXPENSE',
      value: 500000,
    },
    {
      account_id: 'acc-a',
      category_id: IN,
      id: 'row-in',
      paid: true,
      type: 'INCOME',
      value: 92000,
    },
    {
      account_id: 'acc-a',
      category_id: FEE,
      id: 'row-fee',
      paid: true,
      type: 'EXPENSE',
      value: 350,
    },
  ];

  beforeEach(() => {
    spies.transferFindUnique.mockResolvedValueOnce({
      from_account_id: 'acc-b',
      to_account_id: 'acc-a',
      transactions: rows,
    });
    spies.transactionUpdate.mockImplementation((args: { data: Record<string, unknown> }) =>
      Promise.resolve({ ...args.data, id: 'row' }),
    );
  });

  it('SHOULD rewrite the rows in place, apply only the net ledger change AND delete the fee row WHEN the fee is removed', async () => {
    await setup.update('transfer-1', { ...mocks.writeParams, amount_out: 400000, fee: null });

    expect(spies.transactionUpdate).toHaveBeenCalledTimes(2);
    expect(spies.transactionDelete).toHaveBeenCalledWith({ where: { id: 'row-fee' } });
    expect(spies.transferUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ amount_out: 400000, fee: null }),
        where: { id: 'transfer-1' },
      }),
    );
    // acc-a regains the fee (+350), acc-b regains 100000.
    expect(spies.accountUpdate.mock.calls).toEqual([
      [{ data: { ledger_balance: { increment: 350 } }, where: { id: 'acc-a' } }],
      [{ data: { ledger_balance: { increment: 100000 } }, where: { id: 'acc-b' } }],
    ]);
  });

  it('SHOULD revert the old accounts AND apply the new ones WHEN the accounts change', async () => {
    await setup.update('transfer-1', {
      ...mocks.writeParams,
      fee: null,
      from: { account_id: 'acc-c', currency: 'BRL', owner: 'USER', owner_id: 'user-1' },
    });

    const touched = spies.accountUpdate.mock.calls.map((call) => call[0].where.id);
    expect(touched).toEqual(['acc-a', 'acc-b', 'acc-c']);
    expect(spies.queryRaw).toHaveBeenCalledTimes(2);
  });

  it('SHOULD create the in row WHEN the amount in becomes known', async () => {
    spies.transferFindUnique.mockReset();
    spies.transferFindUnique.mockResolvedValueOnce({
      from_account_id: 'acc-b',
      to_account_id: 'acc-a',
      transactions: [rows[0]],
    });
    spies.transactionCreate.mockImplementation(createdRow);

    await setup.update('transfer-1', { ...mocks.writeParams, fee: null });

    expect(spies.transactionCreate).toHaveBeenCalledTimes(1);
    expect(spies.transactionCreate.mock.calls[0][0].data.category_id).toBe(IN);
  });

  it('SHOULD throw NotFound WHEN the transfer does not exist', async () => {
    spies.transferFindUnique.mockReset();
    spies.transferFindUnique.mockResolvedValue(null);

    await expect(setup.update('missing', mocks.writeParams)).rejects.toThrow('Transfer not found');
  });
});

describe('Method delete', () => {
  it('SHOULD delete every row, revert the ledgers AND delete the transfer', async () => {
    spies.transferFindUnique.mockResolvedValue({
      from_account_id: 'acc-b',
      to_account_id: 'acc-a',
      transactions: [
        { account_id: 'acc-b', id: 'row-out', paid: true, type: 'EXPENSE', value: 500000 },
        { account_id: 'acc-a', id: 'row-in', paid: true, type: 'INCOME', value: 92000 },
      ],
    });

    await setup.delete('transfer-1');

    expect(spies.transactionDeleteMany).toHaveBeenCalledWith({
      where: { transfer_id: 'transfer-1' },
    });
    expect(spies.transferDelete).toHaveBeenCalledWith({ where: { id: 'transfer-1' } });
    expect(spies.accountUpdate.mock.calls).toEqual([
      [{ data: { ledger_balance: { increment: -92000 } }, where: { id: 'acc-a' } }],
      [{ data: { ledger_balance: { increment: 500000 } }, where: { id: 'acc-b' } }],
    ]);
  });

  it('SHOULD throw NotFound WHEN the transfer does not exist', async () => {
    spies.transferFindUnique.mockResolvedValue(null);

    await expect(setup.delete('missing')).rejects.toThrow('Transfer not found');
  });
});

describe('Method findById', () => {
  it('SHOULD return the transfer with its row ids', async () => {
    spies.transferFindUnique.mockResolvedValue(mocks.transferRecord);

    expect(await setup.findById('transfer-1')).toEqual(mocks.transferRecord);
  });
});

describe('Method createSeries (spec 098)', () => {
  const rule = {
    end_date: null,
    frequency: 'MONTHLY' as const,
    last_generated_number: 2,
    next_occurrence_date: new Date('2026-12-04T00:00:00.000Z'),
    status: 'ACTIVE' as const,
  };

  beforeEach(() => {
    spies.recurrenceCreate.mockResolvedValue({ id: 'series-1' });
    spies.transferCreate
      .mockResolvedValueOnce({ id: 'transfer-1' })
      .mockResolvedValueOnce({ id: 'transfer-2' });
    spies.transactionCreate.mockImplementation(createdRow);
  });

  it('SHOULD create the series row AND every occurrence with the series id AND its number', async () => {
    const occurrences = [
      { ...mocks.writeParams, amount_in: 92000, fee: null, occurrence_number: 1 },
      { ...mocks.writeParams, amount_in: null, fee: null, occurrence_number: 2, paid: false },
    ];

    expect(await setup.createSeries({ ...rule, occurrences })).toEqual(mocks.transferRecord);

    expect(spies.recurrenceCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        account_id: 'acc-b',
        amount_in: null,
        category_id: OUT,
        last_generated_number: 2,
        to_account_id: 'acc-a',
        type: 'EXPENSE',
        value: 500000,
      }),
      select: { id: true },
    });
    expect(spies.transferCreate.mock.calls.map((call) => call[0].data)).toEqual([
      expect.objectContaining({ occurrence_number: 1, recurrence_id: 'series-1' }),
      expect.objectContaining({ occurrence_number: 2, recurrence_id: 'series-1' }),
    ]);
    expect(spies.transferFindUniqueOrThrow).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'transfer-1' } }),
    );
  });

  it('SHOULD keep a fixed amount in on a same-currency series', async () => {
    const same = {
      ...mocks.writeParams,
      amount_in: 500000,
      fee: null,
      from: { ...mocks.writeParams.from, currency: 'BRL' },
      to: { ...mocks.writeParams.to, currency: 'BRL' },
    };

    await setup.createSeries({ ...rule, occurrences: [same] });

    expect(spies.recurrenceCreate.mock.calls[0][0].data.amount_in).toBe(500000);
  });
});

describe('Method materializeSeries (spec 098)', () => {
  const params = {
    expected_last: 2,
    id: 'series-1',
    last_generated_number: 4,
    next_occurrence_date: new Date('2027-02-04T00:00:00.000Z'),
    occurrences: [
      { date: new Date('2026-12-04T00:00:00.000Z'), number: 3 },
      { date: new Date('2027-01-04T00:00:00.000Z'), number: 4 },
    ],
    status: 'ACTIVE' as const,
  };

  beforeEach(() => {
    spies.queryRaw.mockResolvedValue([
      {
        account_id: 'acc-b',
        amount_in: null,
        description: 'Monthly',
        last_generated_number: 2,
        notes: null,
        to_account_id: 'acc-a',
        value: 100000,
      },
    ]);
    spies.accountFindMany.mockResolvedValue([
      { currency: 'BRL', id: 'acc-b', owner: 'USER', owner_id: 'user-1' },
      { currency: 'USD', id: 'acc-a', owner: 'USER', owner_id: 'user-1' },
    ]);
    spies.transferFindFirst.mockResolvedValue({ created_by: 'user-1' });
    spies.transferFindMany.mockResolvedValue([{ occurrence_number: 3 }]);
    spies.transferCreate.mockResolvedValue({ id: 'transfer-new' });
    spies.transactionCreate.mockImplementation(createdRow);
  });

  it('SHOULD create the missing unpaid occurrences without an in row AND advance the series', async () => {
    await setup.materializeSeries(params);

    expect(spies.transferCreate).toHaveBeenCalledTimes(1);
    expect(spies.transferCreate.mock.calls[0][0].data).toMatchObject({
      amount_in: null,
      occurrence_number: 4,
      paid: false,
      recurrence_id: 'series-1',
    });
    expect(spies.transactionCreate).toHaveBeenCalledTimes(1);
    expect(spies.accountUpdate).not.toHaveBeenCalled();
    expect(spies.recurrenceUpdate).toHaveBeenCalledWith({
      data: {
        last_generated_number: 4,
        next_occurrence_date: params.next_occurrence_date,
        status: 'ACTIVE',
      },
      where: { id: 'series-1' },
    });
  });

  it('SHOULD do nothing WHEN another read already advanced the series OR the series is gone', async () => {
    spies.queryRaw.mockResolvedValueOnce([{ last_generated_number: 3 }]);
    await setup.materializeSeries(params);
    spies.queryRaw.mockResolvedValueOnce([]);
    await setup.materializeSeries(params);

    expect(spies.transferCreate).not.toHaveBeenCalled();
    expect(spies.recurrenceUpdate).not.toHaveBeenCalled();
  });

  it('SHOULD only advance the series WHEN there is nothing to create', async () => {
    await setup.materializeSeries({ ...params, occurrences: [] });

    expect(spies.transferCreate).not.toHaveBeenCalled();
    expect(spies.recurrenceUpdate).toHaveBeenCalledTimes(1);
  });
});

describe('Method deleteSeriesFrom (spec 098)', () => {
  const found = [
    {
      from_account_id: 'acc-b',
      id: 'transfer-3',
      to_account_id: 'acc-a',
      transactions: [
        { account_id: 'acc-b', id: 'row-out', paid: true, type: 'EXPENSE', value: 100000 },
        { account_id: 'acc-a', id: 'row-in', paid: true, type: 'INCOME', value: 20000 },
      ],
    },
    {
      from_account_id: 'acc-b',
      id: 'transfer-4',
      to_account_id: 'acc-a',
      transactions: [
        { account_id: 'acc-b', id: 'row-out-4', paid: false, type: 'EXPENSE', value: 100000 },
      ],
    },
  ];

  beforeEach(() => {
    spies.transferFindMany.mockResolvedValue(found);
  });

  it('SHOULD delete the rows and transfers from the number, revert only the paid ledgers AND end the series', async () => {
    const endDate = new Date('2026-10-04T00:00:00.000Z');

    await setup.deleteSeriesFrom({
      delete_series: false,
      end_date: endDate,
      from_number: 3,
      last_generated_number: 2,
      recurrence_id: 'series-1',
    });

    expect(spies.transferFindMany.mock.calls[0][0].where).toEqual({
      occurrence_number: { gte: 3 },
      recurrence_id: 'series-1',
    });
    expect(spies.transactionDeleteMany).toHaveBeenCalledWith({
      where: { transfer_id: { in: ['transfer-3', 'transfer-4'] } },
    });
    expect(spies.accountUpdate.mock.calls).toEqual([
      [{ data: { ledger_balance: { increment: -20000 } }, where: { id: 'acc-a' } }],
      [{ data: { ledger_balance: { increment: 100000 } }, where: { id: 'acc-b' } }],
    ]);
    expect(spies.transferDeleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['transfer-3', 'transfer-4'] } },
    });
    expect(spies.recurrenceUpdate).toHaveBeenCalledWith({
      data: {
        end_date: endDate,
        last_generated_number: 2,
        next_occurrence_date: null,
        status: 'ENDED',
      },
      where: { id: 'series-1' },
    });
    expect(spies.recurrenceDelete).not.toHaveBeenCalled();
  });

  it('SHOULD delete the series row WHEN nothing is left of it', async () => {
    await setup.deleteSeriesFrom({
      delete_series: true,
      end_date: null,
      from_number: 1,
      last_generated_number: 0,
      recurrence_id: 'series-1',
    });

    expect(spies.recurrenceDelete).toHaveBeenCalledWith({ where: { id: 'series-1' } });
    expect(spies.recurrenceUpdate).not.toHaveBeenCalled();
  });
});

describe('series reads and template (spec 098)', () => {
  it('SHOULD read the occurrences of a series from a number, oldest first', async () => {
    spies.transferFindMany.mockResolvedValue([mocks.transferRecord]);

    expect(await setup.findSeriesFrom('series-1', 3)).toEqual([mocks.transferRecord]);
    expect(spies.transferFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { occurrence_number: 'asc' },
        where: { occurrence_number: { gte: 3 }, recurrence_id: 'series-1' },
      }),
    );
  });

  it('SHOULD patch the series template', async () => {
    await setup.updateSeriesTemplate('series-1', { amount_in: null, value: 90000 });

    expect(spies.recurrenceUpdate).toHaveBeenCalledWith({
      data: { amount_in: null, value: 90000 },
      where: { id: 'series-1' },
    });
  });
});
