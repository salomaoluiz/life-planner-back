import { RecurrenceFrequency } from '@finance/domain/enum';

import { mocks, setup } from './index.mocks';

const base = {
  accessibleOwners: mocks.accessibleOwners,
  id: 'series-1',
  occurrenceNumber: 5,
  today: '2026-10-17',
};

describe('SplitRecurrenceUseCase', () => {
  it('SHOULD end the old series at the previous occurrence AND start a new one that keeps the numbering', async () => {
    const result = await setup.execute({ ...base, value: 220000 });

    expect(mocks.recurrenceRepository.applyChange).toHaveBeenCalledWith({
      deleteAfter: undefined,
      fromNumber: 5,
      newSeries: expect.objectContaining({
        accountId: mocks.series.accountId,
        endDate: '2026-12-05',
        firstNumber: 5,
        frequency: 'MONTHLY',
        lastGeneratedNumber: 6,
        nextOccurrenceDate: '2026-11-05',
        skippedNumbers: [7],
        startDate: '2026-05-05',
        status: 'ACTIVE',
        value: 220000,
      }),
      replaceRows: null,
      rowPatch: expect.objectContaining({ value: 220000 }),
      seriesPatch: {
        endDate: '2026-04-05',
        lastGeneratedNumber: 4,
        nextOccurrenceDate: null,
        skippedNumbers: [3],
        status: 'ENDED',
      },
      sourceId: 'series-1',
    });
    expect(result.recurrence.id).toBe('series-2');
    expect(result.ended?.id).toBe('series-1');
  });

  it('SHOULD only send the fields that changed to the rows (a customised value is not reset by a rename)', async () => {
    await setup.execute({ ...base, description: 'Rent 2' });

    expect(mocks.recurrenceRepository.applyChange.mock.calls[0][0].rowPatch).toEqual({
      accountId: undefined,
      categoryId: undefined,
      creditCardId: undefined,
      description: 'Rent 2',
      value: undefined,
    });
  });

  it('SHOULD rewrite the series itself WHEN the split is at occurrence 1', async () => {
    mocks.recurrenceRepository.applyChange.mockResolvedValue('series-1');

    const result = await setup.execute({ ...base, occurrenceNumber: 1, value: 1 });

    expect(mocks.recurrenceRepository.applyChange).toHaveBeenCalledWith(
      expect.objectContaining({
        fromNumber: 1,
        newSeries: null,
        seriesPatch: expect.objectContaining({
          lastGeneratedNumber: 10,
          nextOccurrenceDate: '2026-11-05',
          skippedNumbers: [3, 7],
          value: 1,
        }),
      }),
    );
    expect(result.ended).toBeNull();
  });

  it('SHOULD regenerate the rows by the new frequency up to the horizon AND drop the skipped numbers', async () => {
    await setup.execute({ ...base, frequency: RecurrenceFrequency.WEEKLY });

    const params = mocks.recurrenceRepository.applyChange.mock.calls[0][0];

    expect(params.replaceRows.map((row: { date: string }) => row.date)).toEqual([
      '2026-05-05',
      '2026-05-12',
      '2026-05-19',
      '2026-05-26',
      '2026-06-02',
      '2026-06-09',
      '2026-06-16',
      '2026-06-23',
      '2026-06-30',
      '2026-07-07',
      '2026-07-14',
      '2026-07-21',
      '2026-07-28',
      '2026-08-04',
      '2026-08-11',
      '2026-08-18',
      '2026-08-25',
      '2026-09-01',
      '2026-09-08',
      '2026-09-15',
      '2026-09-22',
      '2026-09-29',
      '2026-10-06',
      '2026-10-13',
      '2026-10-20',
      '2026-10-27',
    ]);
    expect(params.newSeries).toEqual(
      expect.objectContaining({
        frequency: 'WEEKLY',
        nextOccurrenceDate: '2026-11-03',
        skippedNumbers: [],
        status: 'ACTIVE',
      }),
    );
  });

  it('SHOULD remove the end date AND ask to delete rows after a new one', async () => {
    await setup.execute({ ...base, endDate: null });
    await setup.execute({ ...base, endDate: '2026-11-05' });

    expect(mocks.recurrenceRepository.applyChange.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        deleteAfter: null,
        newSeries: expect.objectContaining({ endDate: null, nextOccurrenceDate: '2026-11-05' }),
      }),
    );
    expect(mocks.recurrenceRepository.applyChange.mock.calls[1][0]).toEqual(
      expect.objectContaining({
        deleteAfter: '2026-11-05',
        newSeries: expect.objectContaining({ nextOccurrenceDate: '2026-11-05', status: 'ACTIVE' }),
      }),
    );
  });

  it('SHOULD end the new series WHEN the end date is reached by what is already generated', async () => {
    await setup.execute({ ...base, endDate: '2026-10-05' });

    expect(mocks.recurrenceRepository.applyChange.mock.calls[0][0].newSeries).toEqual(
      expect.objectContaining({ nextOccurrenceDate: null, status: 'ENDED' }),
    );
  });

  it('SHOULD recompute the invoice of the card rows from the split on WHEN the card changes', async () => {
    const cardSeries = { ...mocks.series, accountId: null, creditCardId: 'card-1' };
    mocks.recurrenceRepository.findById.mockResolvedValue(cardSeries);
    mocks.ensureConsistency.execute.mockResolvedValue({ card: mocks.card });
    mocks.invoicePaymentRepository.findByCardIds.mockResolvedValue([{ invoiceMonth: '2026-06' }]);
    mocks.recurrenceRepository.findOccurrences.mockResolvedValueOnce([
      { date: '2026-04-05', id: 'before', occurrenceNumber: 4 },
      { date: '2026-05-05', id: 'open', occurrenceNumber: 5 },
      { date: '2026-06-05', id: 'next', occurrenceNumber: 6 },
    ]);

    await setup.execute({ ...base, creditCardId: mocks.card.id });

    expect(mocks.recurrenceRepository.applyChange.mock.calls[0][0].rowPatch).toEqual(
      expect.objectContaining({
        creditCardId: mocks.card.id,
        invoiceMonths: [
          { id: 'open', invoiceMonth: '2026-05' },
          { id: 'next', invoiceMonth: '2026-07' },
        ],
      }),
    );
  });

  it('SHOULD not recompute invoices WHEN the card is the same', async () => {
    const cardSeries = { ...mocks.series, accountId: null, creditCardId: 'card-1' };
    mocks.recurrenceRepository.findById.mockResolvedValue(cardSeries);
    mocks.ensureConsistency.execute.mockResolvedValue({ card: mocks.card });

    await setup.execute({ ...base, creditCardId: 'card-1' });

    expect(
      mocks.recurrenceRepository.applyChange.mock.calls[0][0].rowPatch.invoiceMonths,
    ).toBeUndefined();
  });

  it('SHOULD regenerate card rows by the card closing day', async () => {
    const cardSeries = { ...mocks.series, accountId: null, creditCardId: 'card-1' };
    mocks.recurrenceRepository.findById.mockResolvedValue(cardSeries);
    mocks.ensureConsistency.execute.mockResolvedValue({ card: mocks.card });

    await setup.execute({ ...base, frequency: RecurrenceFrequency.YEARLY });

    expect(mocks.recurrenceRepository.applyChange.mock.calls[0][0].replaceRows).toEqual([
      { date: '2026-05-05', invoiceMonth: '2026-05', number: 5 },
    ]);
  });

  it('SHOULD refuse to change between account and card', async () => {
    await expect(setup.execute({ ...base, creditCardId: 'card-1' })).rejects.toThrow(
      'Cannot change between account and card',
    );

    mocks.recurrenceRepository.findById.mockResolvedValue({
      ...mocks.series,
      accountId: null,
      creditCardId: 'card-1',
    });

    await expect(setup.execute({ ...base, accountId: 'account-1' })).rejects.toThrow(
      'Cannot change between account and card',
    );
  });

  it('SHOULD reject a number outside the series', async () => {
    await expect(setup.execute({ ...base, occurrenceNumber: 13 })).rejects.toThrow(
      'occurrenceNumber is not part of the series',
    );

    mocks.recurrenceRepository.findById.mockResolvedValue({ ...mocks.series, firstNumber: 5 });

    await expect(setup.execute({ ...base, occurrenceNumber: 4 })).rejects.toThrow(
      'occurrenceNumber is not part of the series',
    );
  });

  it('SHOULD reject an end date before the split date', async () => {
    await expect(setup.execute({ ...base, endDate: '2026-04-01' })).rejects.toThrow(
      'endDate must not be before the first date',
    );
  });

  it('SHOULD answer 404 for a missing OR inaccessible series', async () => {
    mocks.recurrenceRepository.findById.mockResolvedValue(undefined);

    await expect(setup.execute(base)).rejects.toThrow('Not Found');
  });
});
