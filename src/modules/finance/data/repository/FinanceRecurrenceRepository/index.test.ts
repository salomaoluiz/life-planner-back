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

  it('SHOULD return camelCase future numbers', async () => {
    expect(await setup.findFutureNumbers(['r-1'], '2026-10-31')).toEqual([
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
