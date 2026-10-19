import { RecurrenceFrequency, RecurrenceStatus, TransactionType } from '@finance/domain/enum';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { mocks, setup, spies } from './index.mocks';

const owners = [{ owner: OwnerType.USER, ownerId: 'owner-1' }];

describe('create', () => {
  it('SHOULD translate to columns AND turn calendar dates into UTC-midnight Dates', async () => {
    const id = await setup.create({
      accountId: 'account-1',
      categoryId: 'cat-1',
      description: 'Rent',
      endDate: '2027-09-05',
      frequency: RecurrenceFrequency.MONTHLY,
      lastGeneratedNumber: 1,
      nextOccurrenceDate: '2026-11-05',
      owner: OwnerType.USER,
      ownerId: 'owner-1',
      rows: [{ date: '2026-10-05', number: 1, paid: true }],
      startDate: '2026-10-05',
      status: RecurrenceStatus.ACTIVE,
      type: TransactionType.EXPENSE,
      value: 200000,
    });

    expect(id).toBe('recurrence-1');
    expect(mocks.datasource.create).toHaveBeenCalledWith({
      account_id: 'account-1',
      category_id: 'cat-1',
      credit_card_id: undefined,
      description: 'Rent',
      end_date: new Date('2027-09-05T00:00:00.000Z'),
      frequency: 'MONTHLY',
      last_generated_number: 1,
      next_occurrence_date: new Date('2026-11-05T00:00:00.000Z'),
      owner: 'USER',
      owner_id: 'owner-1',
      rows: [
        {
          date: new Date('2026-10-05T00:00:00.000Z'),
          invoice_month: undefined,
          number: 1,
          paid: true,
        },
      ],
      start_date: new Date('2026-10-05T00:00:00.000Z'),
      status: 'ACTIVE',
      type: 'EXPENSE',
      value: 200000,
    });
  });

  it('SHOULD send null dates WHEN the series has no end and nothing left', async () => {
    await setup.create({
      categoryId: 'cat-1',
      creditCardId: 'card-1',
      description: 'Gym',
      frequency: RecurrenceFrequency.WEEKLY,
      lastGeneratedNumber: 0,
      nextOccurrenceDate: null,
      owner: OwnerType.USER,
      ownerId: 'owner-1',
      rows: [],
      startDate: '2026-10-05',
      status: RecurrenceStatus.ENDED,
      type: TransactionType.EXPENSE,
      value: 100,
    });

    expect(mocks.datasource.create).toHaveBeenCalledWith(
      expect.objectContaining({ end_date: null, next_occurrence_date: null }),
    );
  });
});

describe('reads', () => {
  it('SHOULD map findById AND return undefined when missing', async () => {
    expect(await setup.findById('recurrence-1')).toEqual({ id: 'recurrence-1' });

    mocks.datasource.findById.mockResolvedValueOnce(null);

    expect(await setup.findById('missing')).toBeUndefined();
  });

  it('SHOULD translate the filter to columns', async () => {
    const result = await setup.findByOwners(owners, {
      accountId: 'account-1',
      status: RecurrenceStatus.ACTIVE,
    });

    expect(result).toEqual([{ id: 'recurrence-1' }]);
    expect(mocks.datasource.findByOwners).toHaveBeenCalledWith(owners, {
      account_id: 'account-1',
      credit_card_id: undefined,
      status: 'ACTIVE',
    });
  });

  it('SHOULD find the due series with a UTC Date horizon', async () => {
    await setup.findDue(owners, '2026-10-31');

    expect(mocks.datasource.findDue).toHaveBeenCalledWith(
      owners,
      new Date('2026-10-31T00:00:00.000Z'),
    );
    expect(spies.recurrenceMapper).toHaveBeenCalledTimes(1);
  });

  it('SHOULD return camelCase future numbers AND send them by number', async () => {
    expect(await setup.findFutureNumbers([{ afterNumber: 5, recurrenceId: 'r-1' }])).toEqual([
      { occurrenceNumber: 7, recurrenceId: 'r-1' },
    ]);
  });

  it('SHOULD map the real occurrences to transactions', async () => {
    expect(await setup.findOccurrences('recurrence-1')).toEqual([{ id: 'transaction-1' }]);
    expect(spies.transactionMapper).toHaveBeenCalledTimes(1);
  });
});

describe('materialize', () => {
  it('SHOULD delegate with column names', async () => {
    await setup.materialize({
      expectedLast: 1,
      id: 'recurrence-1',
      lastGeneratedNumber: 3,
      nextOccurrenceDate: null,
      rows: [{ date: '2026-10-12', invoiceMonth: '2026-11', number: 2 }],
      status: RecurrenceStatus.ENDED,
    });

    expect(mocks.datasource.materialize).toHaveBeenCalledWith({
      expected_last: 1,
      id: 'recurrence-1',
      last_generated_number: 3,
      next_occurrence_date: null,
      rows: [
        {
          date: new Date('2026-10-12T00:00:00.000Z'),
          invoice_month: '2026-11',
          number: 2,
          paid: undefined,
        },
      ],
      status: 'ENDED',
    });
  });
});

describe('applyChange', () => {
  it('SHOULD translate the patches to columns AND the dates to UTC-midnight Dates', async () => {
    mocks.datasource.apply.mockResolvedValue('recurrence-2');

    const id = await setup.applyChange({
      deleteAfter: '2026-12-05',
      fromNumber: 5,
      newSeries: {
        categoryId: 'cat-1',
        description: 'Rent',
        endDate: null,
        firstNumber: 5,
        frequency: RecurrenceFrequency.MONTHLY,
        lastGeneratedNumber: 0,
        nextOccurrenceDate: '2026-11-05',
        owner: OwnerType.USER,
        ownerId: 'owner-1',
        skippedNumbers: [],
        startDate: '2026-11-05',
        status: RecurrenceStatus.ACTIVE,
        type: TransactionType.EXPENSE,
        value: 220000,
      },
      replaceRows: [{ date: '2026-11-05', number: 5 }],
      rowPatch: { invoiceMonths: [{ id: 'row-1', invoiceMonth: '2026-11' }], value: 220000 },
      seriesPatch: {
        endDate: '2026-10-05',
        nextOccurrenceDate: null,
        status: RecurrenceStatus.ENDED,
      },
      sourceId: 'recurrence-1',
    });

    expect(id).toBe('recurrence-2');
    expect(mocks.datasource.apply).toHaveBeenCalledWith(
      expect.objectContaining({
        delete_after: new Date('2026-12-05T00:00:00.000Z'),
        from_number: 5,
        new_series: expect.objectContaining({
          end_date: null,
          first_number: 5,
          next_occurrence_date: new Date('2026-11-05T00:00:00.000Z'),
          start_date: new Date('2026-11-05T00:00:00.000Z'),
        }),
        replace_rows: [
          {
            date: new Date('2026-11-05T00:00:00.000Z'),
            invoice_month: undefined,
            number: 5,
            paid: undefined,
          },
        ],
        row_patch: expect.objectContaining({
          invoice_months: [{ id: 'row-1', invoice_month: '2026-11' }],
          value: 220000,
        }),
        series_patch: expect.objectContaining({
          end_date: new Date('2026-10-05T00:00:00.000Z'),
          next_occurrence_date: null,
          status: 'ENDED',
        }),
        source_id: 'recurrence-1',
      }),
    );
  });

  it('SHOULD leave undefined patches undefined AND pass null for no new series', async () => {
    await setup.applyChange({
      fromNumber: 1,
      rowPatch: {},
      seriesPatch: {},
      sourceId: 'recurrence-1',
    });

    expect(mocks.datasource.apply).toHaveBeenCalledWith(
      expect.objectContaining({
        delete_after: undefined,
        new_series: null,
        replace_rows: null,
        row_patch: expect.objectContaining({ invoice_months: undefined }),
        series_patch: expect.objectContaining({ end_date: undefined }),
      }),
    );
  });
});

describe('createOccurrence', () => {
  it('SHOULD delegate with column names AND return the transaction', async () => {
    mocks.datasource.createOccurrence.mockResolvedValue({ id: 'transaction-1' });

    expect(
      await setup.createOccurrence({
        date: '2027-03-05',
        number: 7,
        recurrenceId: 'recurrence-1',
        value: 250000,
      }),
    ).toEqual({ id: 'transaction-1' });
    expect(mocks.datasource.createOccurrence).toHaveBeenCalledWith({
      category_id: undefined,
      date: new Date('2027-03-05T00:00:00.000Z'),
      description: undefined,
      invoice_month: undefined,
      number: 7,
      paid: undefined,
      recurrence_id: 'recurrence-1',
      value: 250000,
    });
  });
});

describe('removeFrom / skipNumber', () => {
  it('SHOULD delegate removeFrom with column names AND return the counts', async () => {
    mocks.datasource.removeFrom.mockResolvedValue({ deleted: 3, detached: 1 });

    expect(
      await setup.removeFrom({
        confirmPaid: true,
        deleteSeries: false,
        detachLocked: false,
        fromNumber: 5,
        id: 'recurrence-1',
        seriesPatch: { endDate: '2026-04-05', status: RecurrenceStatus.ENDED },
      }),
    ).toEqual({ deleted: 3, detached: 1 });
    expect(mocks.datasource.removeFrom).toHaveBeenCalledWith({
      confirm_paid: true,
      delete_series: false,
      detach_locked: false,
      from_number: 5,
      id: 'recurrence-1',
      series_patch: expect.objectContaining({
        end_date: new Date('2026-04-05T00:00:00.000Z'),
        status: 'ENDED',
      }),
    });
  });

  it('SHOULD send no series patch WHEN there is none', async () => {
    await setup.removeFrom({
      confirmPaid: false,
      deleteSeries: true,
      detachLocked: true,
      fromNumber: 0,
      id: 'recurrence-1',
    });

    expect(mocks.datasource.removeFrom.mock.calls[0][0].series_patch).toBeUndefined();
  });

  it('SHOULD delegate skipNumber', async () => {
    await setup.skipNumber('recurrence-1', 4);

    expect(mocks.datasource.skipNumber).toHaveBeenCalledWith('recurrence-1', 4);
  });
});

describe('countBySource / existsByOwner', () => {
  it('SHOULD delegate with column names', async () => {
    mocks.datasource.countBySource.mockResolvedValue(2);
    mocks.datasource.exists.mockResolvedValue(true);

    expect(await setup.countBySource({ creditCardId: 'card-1' })).toBe(2);
    expect(mocks.datasource.countBySource).toHaveBeenCalledWith({
      account_id: undefined,
      credit_card_id: 'card-1',
    });
    expect(await setup.existsByOwner({ owner: OwnerType.FAMILY, ownerId: 'family-1' })).toBe(true);
    expect(mocks.datasource.exists).toHaveBeenCalledWith({ owner: 'FAMILY', owner_id: 'family-1' });
  });
});
