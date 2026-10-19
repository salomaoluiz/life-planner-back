import { RecurrenceFrequency } from '@finance/domain/enum';

import { mocks, setup } from './index.mocks';

const base = { accessibleOwners: mocks.accessibleOwners, today: '2026-10-17' };

describe('MaterializeRecurrencesUseCase', () => {
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
    mocks.creditCardRepository.findCreditCardById.mockResolvedValue(undefined);

    await setup.execute(base);

    expect(mocks.recurrenceRepository.materialize).not.toHaveBeenCalled();
  });

  it('SHOULD reject an invalid today', async () => {
    await expect(setup.execute({ ...base, today: 'nope' })).rejects.toThrow();
  });
});
