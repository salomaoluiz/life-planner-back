import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { mocks, setup, spies } from './index.mocks';

const owners = [{ owner: OwnerType.USER, ownerId: 'owner-1' }];

describe('Method create', () => {
  it('SHOULD insert the series, its rows AND the ledger of the paid first row in ONE transaction', async () => {
    expect(await setup.create(mocks.accountParams)).toBe('recurrence-1');

    expect(spies.transaction).toHaveBeenCalledTimes(1);
    expect(spies.queryRaw).not.toHaveBeenCalled();
    expect(spies.rowCreateMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          account_id: 'account-1',
          invoice_month: null,
          occurrence_number: 1,
          paid: true,
          recurrence_id: 'recurrence-1',
          type: 'EXPENSE',
          value: 200000,
        }),
      ],
    });
    expect(spies.accountUpdate).toHaveBeenCalledWith({
      data: { ledger_balance: { increment: -200000 } },
      where: { id: 'account-1' },
    });
  });

  it('SHOULD store unpaid account rows without touching the ledger', async () => {
    await setup.create({ ...mocks.accountParams, rows: [{ date: new Date(), number: 1 }] });

    expect(spies.rowCreateMany.mock.calls[0][0].data[0].paid).toBe(false);
    expect(spies.accountUpdate).not.toHaveBeenCalled();
  });

  it('SHOULD create a series with no rows without calling createMany', async () => {
    await setup.create({ ...mocks.accountParams, rows: [] });

    expect(spies.rowCreateMany).not.toHaveBeenCalled();
  });

  it('SHOULD lock the card, keep card rows with a NULL paid AND their invoice month', async () => {
    await setup.create({
      ...mocks.accountParams,
      account_id: undefined,
      credit_card_id: 'card-1',
      rows: [{ date: new Date('2026-10-05T00:00:00.000Z'), invoice_month: '2026-11', number: 1 }],
    });

    expect(spies.queryRaw.mock.calls[0][0].sql).toContain('FOR UPDATE');
    expect(spies.rowCreateMany.mock.calls[0][0].data[0]).toEqual(
      expect.objectContaining({ credit_card_id: 'card-1', invoice_month: '2026-11', paid: null }),
    );
    expect(spies.accountUpdate).not.toHaveBeenCalled();
  });

  it('SHOULD write nothing WHEN a card invoice is already paid', async () => {
    spies.paymentFindFirst.mockResolvedValue({ id: 'payment-1' });

    await expect(
      setup.create({
        ...mocks.accountParams,
        account_id: undefined,
        credit_card_id: 'card-1',
        rows: [{ date: new Date(), invoice_month: '2026-11', number: 1 }],
      }),
    ).rejects.toThrow('Invoice is paid');
    expect(spies.recurrenceCreate).not.toHaveBeenCalled();
  });
});

describe('reads', () => {
  it('SHOULD find a series by id with its summaries', async () => {
    spies.recurrenceFindUnique.mockResolvedValue({ id: 'recurrence-1' });

    expect(await setup.findById('recurrence-1')).toEqual({ id: 'recurrence-1' });
    expect(spies.recurrenceFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'recurrence-1' } }),
    );
  });

  it('SHOULD filter by owner, source and status', async () => {
    spies.recurrenceFindMany.mockResolvedValue([]);

    await setup.findByOwners(owners, { account_id: 'account-1', status: 'ACTIVE' });

    expect(spies.recurrenceFindMany.mock.calls[0][0].where).toEqual({
      AND: [
        { OR: [{ owner: 'USER', owner_id: 'owner-1' }] },
        { account_id: 'account-1', credit_card_id: undefined, status: 'ACTIVE' },
      ],
    });
  });

  it('SHOULD only look for ACTIVE series due up to the horizon', async () => {
    const horizon = new Date('2026-10-31T00:00:00.000Z');
    spies.recurrenceFindMany.mockResolvedValue([]);

    await setup.findDue(owners, horizon);

    expect(spies.recurrenceFindMany.mock.calls[0][0].where).toEqual({
      AND: [
        { OR: [{ owner: 'USER', owner_id: 'owner-1' }] },
        { next_occurrence_date: { lte: horizon }, status: 'ACTIVE' },
      ],
    });
  });

  it('SHOULD return no future numbers without querying WHEN there is no series', async () => {
    expect(await setup.findFutureNumbers([], new Date())).toEqual([]);
    expect(spies.rowFindMany).not.toHaveBeenCalled();
  });

  it('SHOULD return the future numbers of the series', async () => {
    const afterDate = new Date('2026-10-31T00:00:00.000Z');
    spies.rowFindMany.mockResolvedValue([{ occurrence_number: 7, recurrence_id: 'r-1' }]);

    expect(await setup.findFutureNumbers(['r-1'], afterDate)).toEqual([
      { occurrence_number: 7, recurrence_id: 'r-1' },
    ]);
    expect(spies.rowFindMany).toHaveBeenCalledWith({
      select: { occurrence_number: true, recurrence_id: true },
      where: { date: { gt: afterDate }, recurrence_id: { in: ['r-1'] } },
    });
  });

  it('SHOULD list the real occurrences ordered by number', async () => {
    spies.rowFindMany.mockResolvedValue([{ id: 'transaction-1' }]);

    expect(await setup.findOccurrences('recurrence-1')).toEqual([{ id: 'transaction-1' }]);
    expect(spies.rowFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { occurrence_number: 'asc' },
        where: { recurrence_id: 'recurrence-1' },
      }),
    );
  });
});

describe('Method materialize', () => {
  const params = {
    expected_last: 1,
    id: 'recurrence-1',
    last_generated_number: 3,
    next_occurrence_date: new Date('2026-12-05T00:00:00.000Z'),
    rows: [{ date: new Date('2026-11-05T00:00:00.000Z'), number: 2 }],
    status: 'ACTIVE' as const,
  };
  const locked = {
    account_id: 'account-1',
    category_id: 'cat-1',
    credit_card_id: null,
    description: 'Rent',
    last_generated_number: 1,
    owner: 'USER',
    owner_id: 'owner-1',
    type: 'EXPENSE',
    value: 200000,
  };

  it('SHOULD insert the rows ignoring duplicates AND advance the series', async () => {
    spies.queryRaw.mockResolvedValue([locked]);

    await setup.materialize(params);

    expect(spies.queryRaw.mock.calls[0][0].sql).toContain('FOR UPDATE');
    expect(spies.rowCreateMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          occurrence_number: 2,
          paid: false,
          recurrence_id: 'recurrence-1',
        }),
      ],
      skipDuplicates: true,
    });
    expect(spies.recurrenceUpdate).toHaveBeenCalledWith({
      data: {
        last_generated_number: 3,
        next_occurrence_date: params.next_occurrence_date,
        status: 'ACTIVE',
      },
      where: { id: 'recurrence-1' },
    });
    expect(spies.accountUpdate).not.toHaveBeenCalled();
  });

  it('SHOULD do nothing WHEN another read already advanced the series', async () => {
    spies.queryRaw.mockResolvedValue([{ ...locked, last_generated_number: 3 }]);

    await setup.materialize(params);

    expect(spies.rowCreateMany).not.toHaveBeenCalled();
    expect(spies.recurrenceUpdate).not.toHaveBeenCalled();
  });

  it('SHOULD do nothing WHEN the series no longer exists', async () => {
    spies.queryRaw.mockResolvedValue([]);

    await setup.materialize(params);

    expect(spies.recurrenceUpdate).not.toHaveBeenCalled();
  });

  it('SHOULD only move the series WHEN no row is due (all skipped)', async () => {
    spies.queryRaw.mockResolvedValue([locked]);

    await setup.materialize({ ...params, rows: [] });

    expect(spies.rowCreateMany).not.toHaveBeenCalled();
    expect(spies.recurrenceUpdate).toHaveBeenCalledTimes(1);
  });
});

describe('Method apply', () => {
  const base = {
    from_number: 5,
    row_patch: {},
    series_patch: {},
    source_id: 'recurrence-1',
  };
  const unpaid = { credit_card_id: null, id: 'row-5', invoice_month: null, paid: false };
  const paidRow = { credit_card_id: null, id: 'row-6', invoice_month: null, paid: true };

  beforeEach(() => {
    spies.recurrenceFindUnique.mockResolvedValue(mocks.source);
    spies.rowFindMany.mockResolvedValue([unpaid, paidRow]);
  });

  it('SHOULD answer 404 WHEN the series does not exist', async () => {
    spies.recurrenceFindUnique.mockResolvedValue(null);

    await expect(setup.apply(base)).rejects.toThrow('Not Found');
  });

  it('SHOULD patch the text of every row AND the value of the unpaid ones only', async () => {
    const id = await setup.apply({
      ...base,
      row_patch: { description: 'Rent 2', value: 220000 },
      series_patch: { value: 220000 },
    });

    expect(id).toBe('recurrence-1');
    expect(spies.rowUpdateMany).toHaveBeenNthCalledWith(1, {
      data: { category_id: undefined, description: 'Rent 2' },
      where: { id: { in: ['row-5', 'row-6'] } },
    });
    expect(spies.rowUpdateMany).toHaveBeenNthCalledWith(2, {
      data: { account_id: undefined, credit_card_id: undefined, value: 220000 },
      where: { id: { in: ['row-5'] } },
    });
    expect(spies.recurrenceUpdate).toHaveBeenCalledWith({
      data: { value: 220000 },
      where: { id: 'recurrence-1' },
    });
    expect(spies.accountUpdate).not.toHaveBeenCalled();
  });

  it('SHOULD move the rows to the new series AND return its id', async () => {
    spies.recurrenceCreate.mockResolvedValue({ id: 'recurrence-2' });

    const id = await setup.apply({
      ...base,
      new_series: { ...mocks.accountParams, first_number: 5, skipped_numbers: [] },
      series_patch: { status: 'ENDED' },
    });

    expect(id).toBe('recurrence-2');
    expect(spies.rowUpdateMany).toHaveBeenCalledWith({
      data: { recurrence_id: 'recurrence-2' },
      where: { id: { in: ['row-5', 'row-6'] } },
    });
  });

  it('SHOULD change nothing on rows WHEN there are none from the number', async () => {
    spies.rowFindMany.mockResolvedValue([]);

    await setup.apply({ ...base, row_patch: { value: 1 } });

    expect(spies.rowUpdateMany).not.toHaveBeenCalled();
    expect(spies.recurrenceUpdate).toHaveBeenCalledTimes(1);
  });

  it('SHOULD move the invoice month only of editable card rows', async () => {
    spies.queryRaw.mockResolvedValue([]);
    spies.recurrenceFindUnique.mockResolvedValue({
      ...mocks.source,
      account_id: null,
      credit_card_id: 'card-1',
    });
    spies.paymentFindMany.mockResolvedValue([
      { credit_card_id: 'card-1', invoice_month: '2026-09' },
    ]);
    spies.rowFindMany.mockResolvedValue([
      { credit_card_id: 'card-1', id: 'open', invoice_month: '2026-10', paid: null },
      { credit_card_id: 'card-1', id: 'closed', invoice_month: '2026-09', paid: null },
    ]);

    await setup.apply({
      ...base,
      row_patch: {
        invoice_months: [
          { id: 'open', invoice_month: '2026-11' },
          { id: 'closed', invoice_month: '2026-11' },
        ],
      },
    });

    expect(spies.rowUpdate).toHaveBeenCalledTimes(1);
    expect(spies.rowUpdate).toHaveBeenCalledWith({
      data: { invoice_month: '2026-11' },
      where: { id: 'open' },
    });
  });

  it('SHOULD delete the rows after the new end date', async () => {
    const after = new Date('2026-12-05T00:00:00.000Z');
    spies.rowFindMany.mockResolvedValueOnce([unpaid]).mockResolvedValueOnce([]);

    await setup.apply({ ...base, delete_after: after });

    expect(spies.rowDeleteMany).toHaveBeenCalledWith({ where: { id: { in: ['row-5'] } } });
    expect(spies.rowFindMany.mock.calls[0][0].where).toEqual({
      date: { gt: after },
      recurrence_id: 'recurrence-1',
    });
  });

  it('SHOULD refuse to shorten the end date over a paid row', async () => {
    spies.rowFindMany.mockResolvedValueOnce([paidRow]);

    await expect(
      setup.apply({ ...base, delete_after: new Date('2026-12-05T00:00:00.000Z') }),
    ).rejects.toThrow('Occurrences after the new end date are paid');
    expect(spies.rowDeleteMany).not.toHaveBeenCalled();
  });

  it('SHOULD replace the rows from the number with the regenerated ones, with the template of the series', async () => {
    spies.rowFindMany.mockResolvedValue([unpaid]);

    await setup.apply({
      ...base,
      replace_rows: [{ date: new Date('2026-11-05T00:00:00.000Z'), number: 5 }],
      series_patch: { description: 'Rent 2', value: 1 },
    });

    expect(spies.rowDeleteMany).toHaveBeenCalledWith({ where: { id: { in: ['row-5'] } } });
    expect(spies.rowCreateMany.mock.calls[0][0].data).toEqual([
      expect.objectContaining({
        description: 'Rent 2',
        occurrence_number: 5,
        recurrence_id: 'recurrence-1',
        value: 1,
      }),
    ]);
  });

  it('SHOULD use the new series as the template WHEN replacing into it', async () => {
    spies.rowFindMany.mockResolvedValue([unpaid]);
    spies.recurrenceCreate.mockResolvedValue({ id: 'recurrence-2' });

    await setup.apply({
      ...base,
      new_series: { ...mocks.accountParams, first_number: 5, skipped_numbers: [], value: 9 },
      replace_rows: [{ date: new Date('2026-11-05T00:00:00.000Z'), number: 5 }],
    });

    expect(spies.rowCreateMany.mock.calls[0][0].data[0]).toEqual(
      expect.objectContaining({ recurrence_id: 'recurrence-2', value: 9 }),
    );
  });

  it('SHOULD refuse to replace WHEN an affected row is paid', async () => {
    await expect(
      setup.apply({ ...base, replace_rows: [{ date: new Date(), number: 5 }] }),
    ).rejects.toThrow('An occurrence is paid');
    expect(spies.rowDeleteMany).not.toHaveBeenCalled();
  });
});
