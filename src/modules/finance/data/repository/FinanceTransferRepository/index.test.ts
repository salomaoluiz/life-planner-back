import { mocks, setup, spies } from './index.mocks';

it('SHOULD create through the datasource with calendar dates as Date AND map the result', async () => {
  spies.create.mockResolvedValue(mocks.record);

  const result = await setup.createTransfer(mocks.params);

  expect(spies.create).toHaveBeenCalledWith(
    expect.objectContaining({
      amount_in: 92000,
      date_in: new Date('2026-11-06T00:00:00.000Z'),
      from: expect.objectContaining({ account_id: 'acc-b' }),
      occurrence_number: null,
      recurrence_id: null,
    }),
  );
  expect(result.rowIds).toEqual(['row-out', 'row-in']);
});

it('SHOULD update through the datasource', async () => {
  spies.update.mockResolvedValue(mocks.record);

  expect((await setup.updateTransfer('transfer-1', mocks.params)).id).toBe('transfer-1');
  expect(spies.update).toHaveBeenCalledWith('transfer-1', expect.any(Object));
});

it('SHOULD delete through the datasource', async () => {
  await setup.deleteTransfer('transfer-1');

  expect(spies.delete).toHaveBeenCalledWith('transfer-1');
});

it('SHOULD find a transfer AND return undefined WHEN it does not exist', async () => {
  spies.findById.mockResolvedValueOnce(mocks.record).mockResolvedValueOnce(null);

  expect((await setup.findTransferById('transfer-1'))?.id).toBe('transfer-1');
  expect(await setup.findTransferById('missing')).toBeUndefined();
});

it('SHOULD create a series with Date fields AND the occurrences as datasource params', async () => {
  spies.createSeries.mockResolvedValue(mocks.record);

  const result = await setup.createTransferSeries({
    endDate: '2027-11-04',
    frequency: 'MONTHLY' as never,
    lastGeneratedNumber: 1,
    nextOccurrenceDate: '2026-12-04',
    occurrences: [{ ...mocks.params, occurrenceNumber: 1 }],
    status: 'ACTIVE' as never,
  });

  expect(result.id).toBe('transfer-1');
  expect(spies.createSeries).toHaveBeenCalledWith({
    end_date: new Date('2027-11-04T00:00:00.000Z'),
    frequency: 'MONTHLY',
    last_generated_number: 1,
    next_occurrence_date: new Date('2026-12-04T00:00:00.000Z'),
    occurrences: [expect.objectContaining({ occurrence_number: 1 })],
    status: 'ACTIVE',
  });
});

it('SHOULD keep empty series dates null', async () => {
  spies.createSeries.mockResolvedValue(mocks.record);

  await setup.createTransferSeries({
    endDate: null,
    frequency: 'MONTHLY' as never,
    lastGeneratedNumber: 1,
    nextOccurrenceDate: null,
    occurrences: [mocks.params],
    status: 'ENDED' as never,
  });

  expect(spies.createSeries).toHaveBeenCalledWith(
    expect.objectContaining({ end_date: null, next_occurrence_date: null }),
  );
});

it('SHOULD materialize a series with Date occurrences', async () => {
  await setup.materializeTransferSeries({
    expectedLast: 1,
    id: 'series-1',
    lastGeneratedNumber: 3,
    nextOccurrenceDate: '2027-02-04',
    occurrences: [{ date: '2027-01-04', number: 3 }],
    status: 'ACTIVE' as never,
  });
  await setup.materializeTransferSeries({
    expectedLast: 3,
    id: 'series-1',
    lastGeneratedNumber: 3,
    nextOccurrenceDate: null,
    occurrences: [],
    status: 'ENDED' as never,
  });

  expect(spies.materializeSeries).toHaveBeenNthCalledWith(1, {
    expected_last: 1,
    id: 'series-1',
    last_generated_number: 3,
    next_occurrence_date: new Date('2027-02-04T00:00:00.000Z'),
    occurrences: [{ date: new Date('2027-01-04T00:00:00.000Z'), number: 3 }],
    status: 'ACTIVE',
  });
  expect(spies.materializeSeries).toHaveBeenNthCalledWith(
    2,
    expect.objectContaining({ next_occurrence_date: null, occurrences: [] }),
  );
});

it('SHOULD delete the occurrences of a series from a number with the end date as a Date', async () => {
  await setup.deleteTransferSeriesFrom({
    deleteSeries: false,
    endDate: '2026-10-04',
    fromNumber: 3,
    lastGeneratedNumber: 2,
    recurrenceId: 'series-1',
  });
  await setup.deleteTransferSeriesFrom({
    deleteSeries: true,
    endDate: null,
    fromNumber: 1,
    lastGeneratedNumber: 0,
    recurrenceId: 'series-1',
  });

  expect(spies.deleteSeriesFrom).toHaveBeenNthCalledWith(1, {
    delete_series: false,
    end_date: new Date('2026-10-04T00:00:00.000Z'),
    from_number: 3,
    last_generated_number: 2,
    recurrence_id: 'series-1',
  });
  expect(spies.deleteSeriesFrom).toHaveBeenNthCalledWith(
    2,
    expect.objectContaining({ delete_series: true, end_date: null }),
  );
});

it('SHOULD read the occurrences of a series from a number AND map them', async () => {
  spies.findSeriesFrom.mockResolvedValue([mocks.record]);

  const result = await setup.findSeriesTransfersFrom('series-1', 3);

  expect(spies.findSeriesFrom).toHaveBeenCalledWith('series-1', 3);
  expect(result.map((item) => item.id)).toEqual(['transfer-1']);
});

it('SHOULD rename the template fields for the datasource', async () => {
  await setup.updateSeriesTemplate('series-1', {
    amountIn: null,
    amountOut: 90000,
    description: 'New',
  });

  expect(spies.updateSeriesTemplate).toHaveBeenCalledWith('series-1', {
    amount_in: null,
    description: 'New',
    notes: undefined,
    value: 90000,
  });
});

it('SHOULD write many transfers through one datasource call AND return how many', async () => {
  spies.createMany.mockResolvedValue(2);

  expect(await setup.createTransfers([mocks.params, mocks.params])).toBe(2);
  expect(spies.createMany).toHaveBeenCalledWith([
    expect.objectContaining({ date_out: new Date('2026-11-04T00:00:00.000Z') }),
    expect.objectContaining({ date_out: new Date('2026-11-04T00:00:00.000Z') }),
  ]);
});
