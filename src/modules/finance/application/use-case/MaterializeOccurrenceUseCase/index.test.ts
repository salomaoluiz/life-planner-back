import { mocks, setup } from './index.mocks';

const base = {
  accessibleOwners: mocks.accessibleOwners,
  occurrenceNumber: 7,
  recurrenceId: 'series-1',
  today: '2026-10-17',
};

describe('MaterializeOccurrenceUseCase', () => {
  it('SHOULD create the real, unpaid row of a projected occurrence with the edits', async () => {
    const result = await setup.execute({ ...base, value: 250000 });

    expect(mocks.recurrenceRepository.createOccurrence).toHaveBeenCalledWith({
      categoryId: undefined,
      date: '2027-04-05',
      description: undefined,
      invoiceMonth: undefined,
      number: 7,
      paid: false,
      recurrenceId: 'series-1',
      value: 250000,
    });
    expect(result).toEqual({ overLimit: false, transaction: mocks.transaction });
  });

  it('SHOULD use the date sent AND check a new category against the series owner', async () => {
    await setup.execute({ ...base, categoryId: 'category-2', date: '2027-04-10', paid: true });

    expect(mocks.recurrenceRepository.createOccurrence).toHaveBeenCalledWith(
      expect.objectContaining({ categoryId: 'category-2', date: '2027-04-10', paid: false }),
    );
    expect(mocks.ensureConsistency.execute).toHaveBeenCalledWith(
      expect.objectContaining({ blockArchivedAccount: false, categoryId: 'category-2' }),
    );
  });

  it('SHOULD give a card occurrence the invoice of its date AND flag the limit', async () => {
    mocks.recurrenceRepository.findById.mockResolvedValue({
      ...mocks.series,
      accountId: null,
      creditCardId: mocks.card.id,
    });
    mocks.ensureConsistency.execute.mockResolvedValue({ card: mocks.card });
    mocks.compute.execute.mockResolvedValue([{ invoices: { used: 99_999 } }]);

    const result = await setup.execute(base);

    expect(mocks.recurrenceRepository.createOccurrence).toHaveBeenCalledWith(
      expect.objectContaining({ invoiceMonth: '2027-04', paid: undefined }),
    );
    expect(result.overLimit).toBe(true);
  });

  it('SHOULD refuse a paid flag on a card occurrence', async () => {
    mocks.recurrenceRepository.findById.mockResolvedValue({
      ...mocks.series,
      accountId: null,
      creditCardId: mocks.card.id,
    });

    await expect(setup.execute({ ...base, paid: true })).rejects.toThrow(
      'Card purchases follow their invoice',
    );
  });

  it('SHOULD answer 409 WHEN the occurrence is already real (or was already generated)', async () => {
    await expect(setup.execute({ ...base, occurrenceNumber: 1 })).rejects.toThrow(
      'Occurrence is already real',
    );
    expect(mocks.recurrenceRepository.createOccurrence).not.toHaveBeenCalled();
  });

  it('SHOULD answer 404 WHEN the occurrence was deleted OR is not part of the series', async () => {
    await expect(setup.execute({ ...base, occurrenceNumber: 4 })).rejects.toThrow(
      'Occurrence was deleted',
    );

    mocks.recurrenceRepository.findById.mockResolvedValue({
      ...mocks.series,
      endDate: '2026-12-05',
    });

    await expect(setup.execute({ ...base, occurrenceNumber: 9 })).rejects.toThrow(
      'Occurrence not found',
    );
    await expect(setup.execute({ ...base, occurrenceNumber: 0 })).rejects.toThrow();
  });

  it('SHOULD answer 404 for a missing OR inaccessible series', async () => {
    mocks.recurrenceRepository.findById.mockResolvedValue({ ...mocks.series, ownerId: 'other' });

    await expect(setup.execute(base)).rejects.toThrow('Not Found');
  });
});
