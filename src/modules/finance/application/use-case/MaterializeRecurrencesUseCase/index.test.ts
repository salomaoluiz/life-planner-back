import { RecurrenceFrequency } from '@finance/domain/enum';

import { mocks, setup } from './index.mocks';

const base = { accessibleOwners: mocks.accessibleOwners, today: '2026-10-17' };

describe('MaterializeRecurrencesUseCase', () => {
  it('SHOULD run through the gate with the non-archived owner ids AND today (spec 081)', async () => {
    await setup.execute(base);

    expect(mocks.gate.runOnce).toHaveBeenCalledWith(
      ['user-id'],
      '2026-10-17',
      expect.any(Function),
    );
  });

  it('SHOULD not query WHEN the gate skips the run (spec 081)', async () => {
    mocks.gate.runOnce.mockResolvedValue(undefined);

    await setup.execute(base);

    expect(mocks.recurrenceRepository.findDue).not.toHaveBeenCalled();
  });

  it('SHOULD not touch the gate WHEN every owner is archived (spec 081)', async () => {
    const archived = mocks.accessibleOwners.map((access) => ({ ...access, archived: true }));

    await setup.execute({ ...base, accessibleOwners: archived });

    expect(mocks.gate.runOnce).not.toHaveBeenCalled();
  });

  it('SHOULD create the missing weekly rows up to the end of the month, not paid, AND advance the series', async () => {
    await setup.execute(base);

    expect(mocks.recurrenceRepository.findDue).toHaveBeenCalledWith(
      mocks.accessibleOwners,
      '2026-10-31',
    );
    expect(mocks.recurrenceRepository.materialize).toHaveBeenCalledWith({
      expectedLast: 1,
      id: 'series-1',
      lastGeneratedNumber: 5,
      nextOccurrenceDate: '2026-11-05',
      rows: [
        { date: '2026-10-08', number: 2, paid: false },
        { date: '2026-10-15', number: 3, paid: false },
        { date: '2026-10-22', number: 4, paid: false },
        { date: '2026-10-29', number: 5, paid: false },
      ],
      status: 'ACTIVE',
    });
  });

  it('SHOULD never materialize for an archived family, even when it is requested explicitly (spec 042)', async () => {
    const archived = mocks.accessibleOwners.map((access) => ({ ...access, archived: true }));

    await setup.execute({
      ...base,
      accessibleOwners: archived,
      ownerIds: archived.map((a) => a.ownerId),
    });

    expect(mocks.recurrenceRepository.findDue).not.toHaveBeenCalled();
    expect(mocks.recurrenceRepository.materialize).not.toHaveBeenCalled();
  });

  it('SHOULD not skip numbers that were deleted as projected', async () => {
    mocks.recurrenceRepository.findDue.mockResolvedValue([
      { ...mocks.weeklySeries, skippedNumbers: [3] },
    ]);

    await setup.execute(base);

    const { rows } = mocks.recurrenceRepository.materialize.mock.calls[0][0];

    expect(rows.map((row: { number: number }) => row.number)).toEqual([2, 4, 5]);
  });

  it('SHOULD end the series WHEN the end date is reached', async () => {
    mocks.recurrenceRepository.findDue.mockResolvedValue([
      { ...mocks.weeklySeries, endDate: '2026-10-15' },
    ]);

    await setup.execute(base);

    expect(mocks.recurrenceRepository.materialize).toHaveBeenCalledWith(
      expect.objectContaining({ nextOccurrenceDate: null, status: 'ENDED' }),
    );
  });

  it('SHOULD do nothing WHEN no series is due', async () => {
    mocks.recurrenceRepository.findDue.mockResolvedValue([]);

    await setup.execute(base);

    expect(mocks.invoicePaymentRepository.findByCardIds).not.toHaveBeenCalled();
    expect(mocks.recurrenceRepository.materialize).not.toHaveBeenCalled();
  });

  it('SHOULD do nothing WHEN the caller narrowed to an owner it cannot access', async () => {
    await setup.execute({ ...base, ownerIds: ['someone-else'] });

    expect(mocks.recurrenceRepository.findDue).not.toHaveBeenCalled();
  });

  it('SHOULD move a card row to the first unpaid invoice WHEN its own invoice has a payment record', async () => {
    mocks.recurrenceRepository.findDue.mockResolvedValue([
      {
        ...mocks.weeklySeries,
        creditCardId: mocks.card.id,
        frequency: RecurrenceFrequency.MONTHLY,
        lastGeneratedNumber: 1,
        startDate: '2026-08-05',
      },
    ]);
    mocks.invoicePaymentRepository.findByCardIds.mockResolvedValue([
      { creditCardId: mocks.card.id, invoiceMonth: '2026-09' },
      { creditCardId: 'other-card', invoiceMonth: '2026-10' },
    ]);

    await setup.execute(base);

    expect(mocks.recurrenceRepository.materialize).toHaveBeenCalledWith(
      expect.objectContaining({
        rows: [
          { date: '2026-09-05', invoiceMonth: '2026-10', number: 2 },
          { date: '2026-10-05', invoiceMonth: '2026-10', number: 3 },
        ],
      }),
    );
  });

  it('SHOULD skip a card series whose card no longer exists', async () => {
    mocks.recurrenceRepository.findDue.mockResolvedValue([
      { ...mocks.weeklySeries, creditCardId: 'gone' },
    ]);
    mocks.creditCardRepository.findCreditCardsByIds.mockResolvedValue([]);

    await setup.execute(base);

    expect(mocks.recurrenceRepository.materialize).not.toHaveBeenCalled();
  });

  it('SHOULD load the cards of several due series with ONE findCreditCardsByIds call', async () => {
    mocks.recurrenceRepository.findDue.mockResolvedValue([
      { ...mocks.weeklySeries, creditCardId: mocks.card.id, id: 'series-1' },
      { ...mocks.weeklySeries, creditCardId: mocks.card.id, id: 'series-2' },
      { ...mocks.weeklySeries, creditCardId: null, id: 'series-3' },
    ]);

    await setup.execute(base);

    expect(mocks.creditCardRepository.findCreditCardsByIds).toHaveBeenCalledTimes(1);
    expect(mocks.creditCardRepository.findCreditCardsByIds).toHaveBeenCalledWith([mocks.card.id]);
    expect(mocks.invoicePaymentRepository.findByCardIds).toHaveBeenCalledTimes(1);
    expect(mocks.recurrenceRepository.materialize).toHaveBeenCalledTimes(3);
  });

  it('SHOULD NOT load cards WHEN only account series are due', async () => {
    await setup.execute(base);

    expect(mocks.creditCardRepository.findCreditCardsByIds).not.toHaveBeenCalled();
    expect(mocks.recurrenceRepository.materialize).toHaveBeenCalledTimes(1);
  });

  it('SHOULD still materialize the other series WHEN one card is missing', async () => {
    mocks.recurrenceRepository.findDue.mockResolvedValue([
      { ...mocks.weeklySeries, creditCardId: 'gone', id: 'series-1' },
      { ...mocks.weeklySeries, id: 'series-2' },
    ]);
    mocks.creditCardRepository.findCreditCardsByIds.mockResolvedValue([]);

    await setup.execute(base);

    expect(mocks.recurrenceRepository.materialize).toHaveBeenCalledTimes(1);
    expect(mocks.recurrenceRepository.materialize).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'series-2' }),
    );
  });

  it('SHOULD reject an invalid today', async () => {
    await expect(setup.execute({ ...base, today: 'nope' })).rejects.toThrow();
  });
});

describe('transfer series (spec 098)', () => {
  const transferSeries = {
    creditCardId: null,
    endDate: null,
    firstNumber: 1,
    frequency: RecurrenceFrequency.MONTHLY,
    id: 'series-t',
    lastGeneratedNumber: 1,
    skippedNumbers: [],
    startDate: '2026-09-17',
    toAccountId: 'acc-to',
  };

  it('SHOULD materialize a transfer series through the transfer repository AND leave the card reads alone', async () => {
    mocks.recurrenceRepository.findDue.mockResolvedValue([transferSeries]);

    await setup.execute(base);

    expect(mocks.transferRepository.materializeTransferSeries).toHaveBeenCalledWith({
      expectedLast: 1,
      id: 'series-t',
      lastGeneratedNumber: 2,
      nextOccurrenceDate: '2026-11-17',
      occurrences: [{ date: '2026-10-17', number: 2 }],
      status: 'ACTIVE',
    });
    expect(mocks.recurrenceRepository.materialize).not.toHaveBeenCalled();
    expect(mocks.creditCardRepository.findCreditCardsByIds).not.toHaveBeenCalled();
  });

  it('SHOULD handle standard and transfer series in the same run', async () => {
    mocks.recurrenceRepository.findDue.mockResolvedValue([
      { ...mocks.weeklySeries, creditCardId: null, toAccountId: null },
      transferSeries,
    ]);

    await setup.execute(base);

    expect(mocks.recurrenceRepository.materialize).toHaveBeenCalledTimes(1);
    expect(mocks.transferRepository.materializeTransferSeries).toHaveBeenCalledTimes(1);
  });

  it('SHOULD end a transfer series whose end date was reached', async () => {
    mocks.recurrenceRepository.findDue.mockResolvedValue([
      { ...transferSeries, endDate: '2026-10-20' },
    ]);

    await setup.execute(base);

    expect(mocks.transferRepository.materializeTransferSeries).toHaveBeenCalledWith(
      expect.objectContaining({ nextOccurrenceDate: null, status: 'ENDED' }),
    );
  });
});
