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
