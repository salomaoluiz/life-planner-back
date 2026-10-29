import { mocks, setup } from './index.mocks';

const base = {
  accessibleOwners: mocks.accessibleOwners,
  from: '2026-11',
  to: '2026-12',
  today: '2026-10-17',
};

describe('GetProjectionsUseCase', () => {
  it('SHOULD project the occurrences of the requested months, numbered from the first number', async () => {
    const result = await setup.execute(base);

    expect(result.map((item) => [item.date, item.occurrenceNumber])).toEqual([
      ['2026-11-05', 2],
      ['2026-12-05', 3],
    ]);
    expect(result[0]).toMatchObject({
      category: mocks.series.category,
      invoiceMonth: null,
      occurrenceCount: null,
      recurrenceId: 'series-1',
      value: mocks.series.value,
    });
  });

  it('SHOULD never project dates up to the end of the current month (they are real rows)', async () => {
    const result = await setup.execute({ ...base, from: '2026-10' });

    expect(result.map((item) => item.date)).toEqual(['2026-11-05', '2026-12-05']);
  });

  it('SHOULD return a series that starts after the horizon', async () => {
    mocks.recurrenceRepository.findByOwners.mockResolvedValue([
      { ...mocks.series, lastGeneratedNumber: 0, startDate: '2026-11-20' },
    ]);

    const result = await setup.execute({ ...base, to: '2026-11' });

    expect(result.map((item) => [item.date, item.occurrenceNumber])).toEqual([['2026-11-20', 1]]);
  });

  it('SHOULD hide skipped numbers AND numbers that are already real', async () => {
    mocks.recurrenceRepository.findByOwners.mockResolvedValue([
      { ...mocks.series, skippedNumbers: [2] },
    ]);
    mocks.recurrenceRepository.findFutureNumbers.mockResolvedValue([
      { occurrenceNumber: 3, recurrenceId: 'series-1' },
      { occurrenceNumber: 9, recurrenceId: 'other-series' },
    ]);

    expect(await setup.execute({ ...base, to: '2027-01' })).toEqual([
      expect.objectContaining({ date: '2027-01-05', occurrenceNumber: 4 }),
    ]);
  });

  it('SHOULD give a card projection the invoice of its date by the current closing day', async () => {
    mocks.recurrenceRepository.findByOwners.mockResolvedValue([
      { ...mocks.series, creditCardId: mocks.card.id },
    ]);

    const result = await setup.execute({ ...base, to: '2026-11' });

    expect(result[0].invoiceMonth).toBe('2026-11');
    // Closing day 10, due day of the fixture card: the planned payment day of that invoice.
    expect(result[0].invoiceListDate).toMatch(/^2026-1[12]-\d{2}$/);
    expect(mocks.creditCardRepository.findCreditCardById).toHaveBeenCalledWith(mocks.card.id);
  });

  it('SHOULD sort by date across series', async () => {
    mocks.recurrenceRepository.findByOwners.mockResolvedValue([
      { ...mocks.series, id: 'b', startDate: '2026-10-20' },
      { ...mocks.series, id: 'a', startDate: '2026-10-05' },
    ]);

    const result = await setup.execute({ ...base, to: '2026-11' });

    expect(result.map((item) => item.recurrenceId)).toEqual(['a', 'b']);
  });

  it('SHOULD reject a range over 12 months OR reversed', async () => {
    await expect(setup.execute({ ...base, from: '2026-11', to: '2027-11' })).rejects.toThrow(
      'The range must be 1 to 12 months',
    );
    await expect(setup.execute({ ...base, from: '2026-12', to: '2026-11' })).rejects.toThrow();
    await expect(setup.execute({ ...base, from: '2026-11', to: '2027-10' })).resolves.toBeDefined();
  });

  it('SHOULD return nothing WHEN there is no accessible owner OR no series OR the range is past', async () => {
    expect(await setup.execute({ ...base, ownerIds: ['other'] })).toEqual([]);

    mocks.recurrenceRepository.findByOwners.mockResolvedValue([]);

    expect(await setup.execute(base)).toEqual([]);

    mocks.recurrenceRepository.findByOwners.mockResolvedValue([mocks.series]);

    expect(await setup.execute({ ...base, from: '2026-09', to: '2026-10' })).toEqual([]);
  });
});

describe('filters (spec 045)', () => {
  const other = { ...mocks.series, categoryId: 'other-cat', description: 'Gym', id: 'series-2' };

  beforeEach(() => {
    mocks.recurrenceRepository.findByOwners.mockResolvedValue([
      {
        ...mocks.series,
        categoryId: 'market',
        description: 'MERCADÃO',
        tags: [{ id: 't1', name: 'fixo' }],
      },
      other,
    ]);
  });

  it('SHOULD keep only the series of the chosen categories (expanded)', async () => {
    mocks.expand.execute.mockResolvedValue(['market', 'greens']);

    const result = await setup.execute({ ...base, filter: { categoryIds: ['market'] } });

    expect(new Set(result.map((item) => item.recurrenceId))).toEqual(new Set([mocks.series.id]));
  });

  it('SHOULD filter by tag and by text ignoring accents', async () => {
    expect(
      new Set(
        (await setup.execute({ ...base, filter: { tagIds: ['t1'] } })).map((i) => i.recurrenceId),
      ),
    ).toEqual(new Set([mocks.series.id]));
    expect(
      new Set(
        (await setup.execute({ ...base, filter: { q: 'mercadao' } })).map((i) => i.recurrenceId),
      ),
    ).toEqual(new Set([mocks.series.id]));
  });

  it('SHOULD keep only series of the chosen accounts or cards', async () => {
    mocks.recurrenceRepository.findByOwners.mockResolvedValue([
      { ...mocks.series, accountId: 'acc-1', creditCardId: null },
      { ...other, accountId: null, creditCardId: 'card-9' },
    ]);

    const byAccount = await setup.execute({ ...base, filter: { accountIds: ['acc-1'] } });
    const byCard = await setup.execute({ ...base, filter: { creditCardIds: ['card-9'] } });

    expect(new Set(byAccount.map((i) => i.recurrenceId))).toEqual(new Set([mocks.series.id]));
    expect(new Set(byCard.map((i) => i.recurrenceId))).toEqual(new Set(['series-2']));
  });
});

describe('executeChunked (spec 053)', () => {
  it('SHOULD call execute in windows of at most 12 months and merge sorted', async () => {
    const spy = jest.spyOn(setup, 'execute');
    const result = await setup.executeChunked({ ...base, from: '2026-11', to: '2028-10' });

    expect(spy.mock.calls.map(([input]) => [input.from, input.to])).toEqual([
      ['2026-11', '2027-10'],
      ['2027-11', '2028-10'],
    ]);
    expect(result).toHaveLength(24);
    expect(result.map((item) => item.date)).toEqual([...result.map((item) => item.date)].sort());
  });

  it('SHOULD call execute once for a short range', async () => {
    const spy = jest.spyOn(setup, 'execute');

    await setup.executeChunked(base);

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('SHOULD reject a reversed range', async () => {
    await expect(setup.executeChunked({ ...base, from: '2027-01', to: '2026-12' })).rejects.toThrow(
      'The range must be 1 to 12 months',
    );
  });
});
