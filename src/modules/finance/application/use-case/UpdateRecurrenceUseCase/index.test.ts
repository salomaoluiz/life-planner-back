import { mocks, setup } from './index.mocks';

const base = { accessibleOwners: mocks.accessibleOwners, id: 'series-1', today: '2026-10-17' };

describe('UpdateRecurrenceUseCase', () => {
  it('SHOULD patch the template AND every row from the first number, sending only what changed', async () => {
    const result = await setup.execute({ ...base, description: 'Rent 2', value: 220000 });

    expect(mocks.recurrenceRepository.applyChange).toHaveBeenCalledWith({
      deleteAfter: undefined,
      fromNumber: 1,
      rowPatch: { categoryId: undefined, description: 'Rent 2', value: 220000 },
      seriesPatch: { categoryId: undefined, description: 'Rent 2', value: 220000 },
      sourceId: 'series-1',
    });
    expect(result).toBe(mocks.series);
  });

  it('SHOULD check the new category against the owner AND the source of the series', async () => {
    await setup.execute({ ...base, categoryId: 'category-2' });

    expect(mocks.ensureConsistency.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: mocks.series.accountId,
        blockArchivedAccount: false,
        categoryId: 'category-2',
        type: mocks.series.type,
      }),
    );
  });

  it('SHOULD end the series AND delete the rows after a shorter end date', async () => {
    await setup.execute({ ...base, endDate: '2026-12-05' });

    expect(mocks.recurrenceRepository.applyChange).toHaveBeenCalledWith(
      expect.objectContaining({
        deleteAfter: '2026-12-05',
        seriesPatch: expect.objectContaining({
          endDate: '2026-12-05',
          nextOccurrenceDate: null,
          status: 'ENDED',
        }),
      }),
    );
  });

  it('SHOULD keep the series active with the next date WHEN the new end date is still ahead', async () => {
    await setup.execute({ ...base, endDate: '2027-09-05' });

    expect(mocks.recurrenceRepository.applyChange.mock.calls[0][0].seriesPatch).toEqual(
      expect.objectContaining({ nextOccurrenceDate: '2027-01-05', status: 'ACTIVE' }),
    );
  });

  it('SHOULD keep a series ended by archiving its account ended', async () => {
    mocks.recurrenceRepository.findById.mockResolvedValue({ ...mocks.series, status: 'ENDED' });
    mocks.accountRepository.findAccountById.mockResolvedValue({ status: 'ARCHIVED' });

    await setup.execute({ ...base, endDate: null });

    expect(mocks.recurrenceRepository.applyChange.mock.calls[0][0].seriesPatch).toEqual({
      categoryId: undefined,
      description: undefined,
      endDate: null,
      value: undefined,
    });
  });

  it('SHOULD keep a series ended by archiving its card ended', async () => {
    mocks.recurrenceRepository.findById.mockResolvedValue({
      ...mocks.series,
      accountId: null,
      creditCardId: 'card-1',
      status: 'ENDED',
    });
    mocks.creditCardRepository.findCreditCardById.mockResolvedValue({ status: 'ARCHIVED' });

    await setup.execute({ ...base, endDate: null });

    expect(
      mocks.recurrenceRepository.applyChange.mock.calls[0][0].seriesPatch.status,
    ).toBeUndefined();
  });

  it('SHOULD reject an end date before the first date', async () => {
    await expect(setup.execute({ ...base, endDate: '2026-10-01' })).rejects.toThrow(
      'endDate must not be before the first date',
    );
    expect(mocks.recurrenceRepository.applyChange).not.toHaveBeenCalled();
  });

  it('SHOULD answer 404 for a missing OR inaccessible series', async () => {
    mocks.recurrenceRepository.findById.mockResolvedValue(undefined);

    await expect(setup.execute({ ...base, value: 1 })).rejects.toThrow('Not Found');

    mocks.recurrenceRepository.findById.mockResolvedValue({ ...mocks.series, ownerId: 'other' });

    await expect(setup.execute({ ...base, value: 1 })).rejects.toThrow('Not Found');
  });
});

describe('an ended series (review)', () => {
  it('SHOULD never restart WHEN its end date is removed or extended (the rest may belong to another series)', async () => {
    mocks.recurrenceRepository.findById.mockResolvedValue({ ...mocks.series, status: 'ENDED' });

    await setup.execute({ ...base, endDate: null });

    expect(mocks.recurrenceRepository.applyChange.mock.calls[0][0].seriesPatch).toEqual({
      categoryId: undefined,
      description: undefined,
      endDate: null,
      value: undefined,
    });
  });
});

it('SHOULD throw 422 "Family is archived" WHEN the owner is archived (spec 042)', async () => {
  const input = { ...base, description: 'Rent 2', value: 220000 };
  const accessibleOwners = input.accessibleOwners.map((access) => ({ ...access, archived: true }));

  await expect(setup.execute({ ...input, accessibleOwners })).rejects.toMatchObject({
    message: 'Family is archived',
    status: 422,
  });
});
