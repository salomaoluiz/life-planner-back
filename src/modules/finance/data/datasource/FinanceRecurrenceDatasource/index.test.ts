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

describe('Method createOccurrence', () => {
  const params = {
    date: new Date('2027-03-05T00:00:00.000Z'),
    number: 7,
    recurrence_id: 'recurrence-1',
    value: 250000,
  };
  const created = {
    account_id: 'account-1',
    paid: false,
    type: 'EXPENSE',
    value: 250000,
  };

  beforeEach(() => {
    spies.recurrenceFindUnique.mockResolvedValue(mocks.source);
    spies.rowFindFirst.mockResolvedValue(null);
    spies.rowCreate.mockResolvedValue(created);
  });

  it('SHOULD create the numbered row with the edits over the template AND not advance the series', async () => {
    expect(await setup.createOccurrence({ ...params, description: 'Rent March' })).toBe(created);

    expect(spies.rowCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        account_id: 'account-1',
        description: 'Rent March',
        occurrence_number: 7,
        paid: false,
        recurrence_id: 'recurrence-1',
        value: 250000,
      }),
      include: expect.any(Object),
    });
    expect(spies.recurrenceUpdate).not.toHaveBeenCalled();
    expect(spies.accountUpdate).not.toHaveBeenCalled();
  });

  it('SHOULD apply the ledger WHEN the new row is paid', async () => {
    spies.rowCreate.mockResolvedValue({ ...created, paid: true });

    await setup.createOccurrence({ ...params, paid: true });

    expect(spies.accountUpdate).toHaveBeenCalledWith({
      data: { ledger_balance: { increment: -250000 } },
      where: { id: 'account-1' },
    });
  });

  it('SHOULD refuse a number that already has a row (409)', async () => {
    spies.rowFindFirst.mockResolvedValue({ id: 'row-7' });

    await expect(setup.createOccurrence(params)).rejects.toThrow('Occurrence already exists');
    expect(spies.rowCreate).not.toHaveBeenCalled();
  });

  it('SHOULD refuse a card row on a paid invoice', async () => {
    spies.recurrenceFindUnique.mockResolvedValue({
      ...mocks.source,
      account_id: null,
      credit_card_id: 'card-1',
    });
    spies.paymentFindFirst.mockResolvedValue({ id: 'payment-1' });

    await expect(setup.createOccurrence({ ...params, invoice_month: '2027-03' })).rejects.toThrow(
      'Invoice is paid',
    );
  });

  it('SHOULD answer 404 WHEN the series does not exist', async () => {
    spies.recurrenceFindUnique.mockResolvedValue(null);

    await expect(setup.createOccurrence(params)).rejects.toThrow('Not Found');
  });
});

describe('Method removeFrom', () => {
  const base = {
    confirm_paid: false,
    delete_series: true,
    detach_locked: true,
    from_number: 0,
    id: 'recurrence-1',
  };
  const unpaid = {
    account_id: 'account-1',
    credit_card_id: null,
    id: 'row-1',
    invoice_month: null,
    paid: false,
    type: 'EXPENSE',
    value: 100,
  };
  const paid = { ...unpaid, id: 'row-2', paid: true, value: 300 };

  beforeEach(() => {
    spies.recurrenceFindUnique.mockResolvedValue(mocks.source);
    spies.rowFindMany.mockResolvedValueOnce([unpaid, paid]).mockResolvedValueOnce([]);
  });

  it('SHOULD answer 404 WHEN the series does not exist', async () => {
    spies.recurrenceFindUnique.mockResolvedValue(null);

    await expect(setup.removeFrom(base)).rejects.toThrow('Not Found');
  });

  it('SHOULD answer 409 with the counts WHEN paid rows would go away without confirmation', async () => {
    await expect(setup.removeFrom(base)).rejects.toMatchObject({
      response: { detachedCount: 0, message: 'Paid occurrences', paidCount: 1, paidTotal: 300 },
      status: 409,
    });
    expect(spies.rowDeleteMany).not.toHaveBeenCalled();
    expect(spies.recurrenceDelete).not.toHaveBeenCalled();
  });

  it('SHOULD delete the rows, reverse the ledger of the paid ones AND delete the series WHEN confirmed', async () => {
    expect(await setup.removeFrom({ ...base, confirm_paid: true })).toEqual({
      deleted: 2,
      detached: 0,
    });

    expect(spies.rowDeleteMany).toHaveBeenCalledWith({ where: { id: { in: ['row-1', 'row-2'] } } });
    expect(spies.accountUpdate).toHaveBeenCalledTimes(1);
    expect(spies.accountUpdate).toHaveBeenCalledWith({
      data: { ledger_balance: { increment: 300 } },
      where: { id: 'account-1' },
    });
    expect(spies.recurrenceDelete).toHaveBeenCalledWith({ where: { id: 'recurrence-1' } });
  });

  it('SHOULD detach card rows in a paid invoice AND refunded rows, deleting the others', async () => {
    spies.queryRaw.mockResolvedValue([]);
    spies.recurrenceFindUnique.mockResolvedValue({
      ...mocks.source,
      account_id: null,
      credit_card_id: 'card-1',
    });
    spies.paymentFindMany.mockResolvedValue([{ invoice_month: '2026-09' }]);
    spies.rowFindMany.mockReset();
    spies.rowFindMany
      .mockResolvedValueOnce([
        {
          ...unpaid,
          account_id: null,
          credit_card_id: 'card-1',
          id: 'in-paid',
          invoice_month: '2026-09',
          paid: null,
        },
        {
          ...unpaid,
          account_id: null,
          credit_card_id: 'card-1',
          id: 'refunded',
          invoice_month: '2026-10',
          paid: null,
        },
        {
          ...unpaid,
          account_id: null,
          credit_card_id: 'card-1',
          id: 'open',
          invoice_month: '2026-10',
          paid: null,
        },
      ])
      .mockResolvedValueOnce([{ refunded_transaction_id: 'refunded' }]);

    expect(await setup.removeFrom(base)).toEqual({ deleted: 1, detached: 2 });

    expect(spies.rowUpdateMany).toHaveBeenCalledWith({
      data: { occurrence_number: null, recurrence_id: null },
      where: { id: { in: ['in-paid', 'refunded'] } },
    });
    expect(spies.rowDeleteMany).toHaveBeenCalledWith({ where: { id: { in: ['open'] } } });
    expect(spies.accountUpdate).not.toHaveBeenCalled();
  });

  it('SHOULD refuse WHEN a row is in a paid invoice AND the scope does not detach', async () => {
    spies.recurrenceFindUnique.mockResolvedValue({
      ...mocks.source,
      account_id: null,
      credit_card_id: 'card-1',
    });
    spies.paymentFindMany.mockResolvedValue([{ invoice_month: '2026-09' }]);
    spies.rowFindMany.mockReset();
    spies.rowFindMany
      .mockResolvedValueOnce([
        {
          ...unpaid,
          account_id: null,
          credit_card_id: 'card-1',
          invoice_month: '2026-09',
          paid: null,
        },
      ])
      .mockResolvedValueOnce([]);

    await expect(setup.removeFrom({ ...base, detach_locked: false })).rejects.toThrow(
      'An occurrence is in a paid invoice',
    );
  });

  it('SHOULD refuse with "Delete its refunds first" WHEN a refunded row would be deleted', async () => {
    spies.rowFindMany.mockReset();
    spies.rowFindMany
      .mockResolvedValueOnce([unpaid])
      .mockResolvedValueOnce([{ refunded_transaction_id: 'row-1' }]);

    await expect(setup.removeFrom({ ...base, detach_locked: false })).rejects.toThrow(
      'Delete its refunds first',
    );
  });

  it('SHOULD patch the series instead of deleting it (THIS_AND_NEXT) AND skip the delete WHEN no row is left', async () => {
    spies.rowFindMany.mockReset();
    spies.rowFindMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    expect(
      await setup.removeFrom({
        ...base,
        delete_series: false,
        from_number: 5,
        series_patch: { status: 'ENDED' },
      }),
    ).toEqual({ deleted: 0, detached: 0 });

    expect(spies.rowDeleteMany).not.toHaveBeenCalled();
    expect(spies.recurrenceDelete).not.toHaveBeenCalled();
    expect(spies.recurrenceUpdate).toHaveBeenCalledWith({
      data: { status: 'ENDED' },
      where: { id: 'recurrence-1' },
    });
  });

  it('SHOULD leave the series untouched WHEN it is neither deleted nor patched', async () => {
    spies.rowFindMany.mockReset();
    spies.rowFindMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    await setup.removeFrom({ ...base, delete_series: false });

    expect(spies.recurrenceUpdate).not.toHaveBeenCalled();
  });
});

describe('Method skipNumber', () => {
  it('SHOULD append the number under the series lock', async () => {
    await setup.skipNumber('recurrence-1', 4);

    expect(spies.queryRaw.mock.calls[0][0].sql).toContain('FOR UPDATE');
    expect(spies.recurrenceUpdate).toHaveBeenCalledWith({
      data: { skipped_numbers: { push: 4 } },
      where: { id: 'recurrence-1' },
    });
  });
});

describe('Method countBySource / exists', () => {
  it('SHOULD count the series of an account OR a card', async () => {
    spies.recurrenceCount.mockResolvedValue(2);

    expect(await setup.countBySource({ account_id: 'account-1' })).toBe(2);
    expect(spies.recurrenceCount).toHaveBeenCalledWith({
      where: { account_id: 'account-1', credit_card_id: undefined },
    });
  });

  it('SHOULD tell whether an owner has series', async () => {
    spies.recurrenceFindFirst
      .mockResolvedValueOnce({ id: 'recurrence-1' })
      .mockResolvedValueOnce(null);

    expect(await setup.exists({ owner: 'USER', owner_id: 'owner-1' })).toBe(true);
    expect(await setup.exists({ owner: 'USER', owner_id: 'owner-1' })).toBe(false);
    expect(spies.recurrenceFindFirst).toHaveBeenCalledWith({
      select: { id: true },
      where: { owner: 'USER', owner_id: 'owner-1' },
    });
  });
});
