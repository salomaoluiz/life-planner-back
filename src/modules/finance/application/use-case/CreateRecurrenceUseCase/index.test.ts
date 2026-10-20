import { RecurrenceFrequency, TransactionType } from '@finance/domain/enum';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { mocks, setup } from './index.mocks';

describe('CreateRecurrenceUseCase', () => {
  it('SHOULD create one real row, paid per the body, WHEN a monthly series dated the 5th is created on the 17th', async () => {
    const result = await setup.execute({ ...mocks.input, paid: false });

    expect(mocks.recurrenceRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        lastGeneratedNumber: 1,
        nextOccurrenceDate: '2026-11-05',
        rows: [{ date: '2026-10-05', number: 1, paid: false }],
        status: 'ACTIVE',
      }),
    );
    expect(result).toEqual({
      occurrences: mocks.occurrences,
      overLimit: false,
      recurrence: mocks.recurrence,
    });
  });

  it('SHOULD default the first row to paid WHEN it is dated up to today', async () => {
    await setup.execute(mocks.input);

    expect(mocks.recurrenceRepository.create.mock.calls[0][0].rows[0].paid).toBe(true);
  });

  it('SHOULD default the first row to not paid WHEN it is dated after today', async () => {
    await setup.execute({ ...mocks.input, date: '2026-10-25' });

    expect(mocks.recurrenceRepository.create.mock.calls[0][0].rows).toEqual([
      { date: '2026-10-25', number: 1, paid: false },
    ]);
  });

  it('SHOULD create no real row WHEN the series starts after the end of the month', async () => {
    await setup.execute({ ...mocks.input, date: '2026-11-05' });

    expect(mocks.recurrenceRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        lastGeneratedNumber: 0,
        nextOccurrenceDate: '2026-11-05',
        rows: [],
      }),
    );
  });

  it('SHOULD create a weekly series with only the first row following the paid flag', async () => {
    await setup.execute({
      ...mocks.input,
      date: '2026-10-01',
      frequency: RecurrenceFrequency.WEEKLY,
      paid: true,
    });

    const { rows } = mocks.recurrenceRepository.create.mock.calls[0][0];

    expect(rows.map((row: { paid: boolean }) => row.paid)).toEqual([
      true,
      false,
      false,
      false,
      false,
    ]);
  });

  it('SHOULD create an ENDED series WHEN everything is already real', async () => {
    await setup.execute({ ...mocks.input, endDate: '2026-10-20' });

    expect(mocks.recurrenceRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ nextOccurrenceDate: null, status: 'ENDED' }),
    );
  });

  it('SHOULD create card rows with their invoice month AND report the limit', async () => {
    mocks.ensureConsistency.execute.mockResolvedValue({ card: { ...mocks.card, closingDay: 10 } });

    const result = await setup.execute({
      ...mocks.input,
      accountId: undefined,
      creditCardId: mocks.card.id,
    });

    expect(mocks.recurrenceRepository.create.mock.calls[0][0].rows).toEqual([
      { date: '2026-10-05', invoiceMonth: '2026-10', number: 1 },
    ]);
    expect(result.overLimit).toBe(true);
  });

  it('SHOULD reject a paid flag on a card series', async () => {
    await expect(
      setup.execute({ ...mocks.input, accountId: undefined, creditCardId: 'card-1', paid: true }),
    ).rejects.toThrow('Card purchases follow their invoice');
  });

  it('SHOULD reject an owner the caller cannot access', async () => {
    await expect(setup.execute({ ...mocks.input, ownerId: 'other' })).rejects.toThrow(
      'Owner not accessible',
    );
    expect(mocks.recurrenceRepository.create).not.toHaveBeenCalled();
  });

  it('SHOULD reject an end date before the first date', async () => {
    await expect(setup.execute({ ...mocks.input, endDate: '2026-10-01' })).rejects.toThrow();
  });

  it('SHOULD reject sending both or neither source', async () => {
    await expect(setup.execute({ ...mocks.input, creditCardId: 'card-1' })).rejects.toThrow();
    await expect(setup.execute({ ...mocks.input, accountId: undefined })).rejects.toThrow();
  });

  it('SHOULD let the consistency check refuse archived sources, system categories and card incomes', async () => {
    mocks.ensureConsistency.execute.mockRejectedValue(new Error('Account is archived'));

    await expect(
      setup.execute({ ...mocks.input, owner: OwnerType.USER, type: TransactionType.INCOME }),
    ).rejects.toThrow('Account is archived');
    expect(mocks.ensureConsistency.execute).toHaveBeenCalledWith(
      expect.objectContaining({ blockArchivedAccount: true }),
    );
  });
});

describe('currency (spec 040)', () => {
  it('SHOULD create the series in the currency of the account AND check a sent currency against it', async () => {
    mocks.ensureConsistency.execute.mockResolvedValueOnce({
      account: { currency: 'USD' },
    });

    await setup.execute({ ...mocks.input, currency: 'USD' });

    expect(mocks.ensureConsistency.execute).toHaveBeenCalledWith(
      expect.objectContaining({ currency: 'USD' }),
    );
    expect(mocks.recurrenceRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ currency: 'USD' }),
    );
  });
});

it('SHOULD throw 422 "Family is archived" WHEN the owner is archived (spec 042)', async () => {
  const input = { ...mocks.input, paid: false };
  const accessibleOwners = input.accessibleOwners.map((access) => ({ ...access, archived: true }));

  await expect(setup.execute({ ...input, accessibleOwners })).rejects.toMatchObject({
    message: 'Family is archived',
    status: 422,
  });
});
