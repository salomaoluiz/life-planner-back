import { mocks, setup } from './index.mocks';

describe('GetDashboardRowsUseCase', () => {
  it('SHOULD return nothing without owners', async () => {
    expect(await setup.execute({ ...mocks.input, accessibleOwners: [] })).toEqual([]);
    expect(mocks.transactionRepository.sumDashboardRows).not.toHaveBeenCalled();
  });

  it('SHOULD count paid account rows as realized on their date', async () => {
    mocks.transactionRepository.sumDashboardRows.mockResolvedValue([mocks.sumOf({})]);

    expect(await setup.execute(mocks.input)).toEqual([
      expect.objectContaining({ amount: 1000, bucketDate: '2026-10-05', projected: false }),
    ]);
  });

  it('SHOULD project unpaid rows of the current month AND drop unpaid rows of earlier months', async () => {
    mocks.transactionRepository.sumDashboardRows.mockResolvedValue([
      mocks.sumOf({ date: '2026-10-25', paid: false }),
      mocks.sumOf({ date: '2026-09-25', paid: false }),
    ]);

    expect(await setup.execute(mocks.input)).toEqual([
      expect.objectContaining({ bucketDate: '2026-10-25', projected: true }),
    ]);
  });

  it('SHOULD keep only realized rows with paid = true AND only projected with paid = false', async () => {
    mocks.transactionRepository.sumDashboardRows.mockResolvedValue([
      mocks.sumOf({ date: '2026-10-05', paid: true }),
      mocks.sumOf({ date: '2026-10-25', paid: false }),
    ]);

    const realized = await setup.execute({ ...mocks.input, filter: { paid: true } });
    const projected = await setup.execute({ ...mocks.input, filter: { paid: false } });

    expect(realized.map((row) => row.projected)).toEqual([false]);
    expect(projected.map((row) => row.projected)).toEqual([true]);
  });

  it('SHOULD count a card purchase on the day its invoice was paid', async () => {
    mocks.compute.execute.mockResolvedValue([
      {
        card: mocks.card,
        invoices: {},
        payments: [
          {
            accountId: null,
            accountName: null,
            amount: 5000,
            method: 'EXTERNAL',
            paidOn: '2026-10-10',
            referenceMonth: '2026-09',
          },
        ],
        totals: [{ amount: 5000, invoiceMonth: '2026-09' }],
      },
    ]);
    mocks.transactionRepository.sumDashboardRows.mockResolvedValue([
      mocks.sumOf({ creditCardId: mocks.card.id, date: null, invoiceMonth: '2026-09', paid: null }),
    ]);

    const rows = await setup.execute({ ...mocks.input, from: '2026-10-01' });

    expect(rows).toEqual([expect.objectContaining({ bucketDate: '2026-10-10', projected: false })]);
    expect(mocks.transactionRepository.sumDashboardRows).toHaveBeenCalledWith(
      expect.objectContaining({
        invoiceRefs: [{ creditCardId: mocks.card.id, invoiceMonth: '2026-09' }],
      }),
    );
  });

  it('SHOULD project an unpaid invoice of the current month AND skip an unpaid one of an earlier month', async () => {
    mocks.compute.execute.mockResolvedValue([
      {
        card: mocks.card,
        invoices: {},
        payments: [],
        totals: [
          { amount: 4000, invoiceMonth: '2026-10' },
          { amount: 3000, invoiceMonth: '2026-03' },
        ],
      },
    ]);
    mocks.transactionRepository.sumDashboardRows.mockResolvedValue([]);

    await setup.execute(mocks.input);

    const refs = mocks.transactionRepository.sumDashboardRows.mock.calls[0][0].invoiceRefs;

    expect(refs.map((ref: { invoiceMonth: string }) => ref.invoiceMonth)).not.toContain('2026-03');
  });

  it('SHOULD not read the cards for the ACCOUNT source AND narrow the sources by the chosen ids', async () => {
    await setup.execute({ ...mocks.input, filter: { accountIds: ['acc-1'] } });

    expect(mocks.creditCardRepository.findCreditCards).not.toHaveBeenCalled();
    expect(mocks.transactionRepository.sumDashboardRows).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'ACCOUNT' }),
    );

    await setup.execute({ ...mocks.input, filter: { creditCardIds: ['card-1'] } });

    expect(mocks.transactionRepository.sumDashboardRows).toHaveBeenLastCalledWith(
      expect.objectContaining({ source: 'CARD' }),
    );
  });

  it('SHOULD expand the chosen categories to their descendants', async () => {
    mocks.expand.execute.mockResolvedValue(['cat-1', 'cat-2']);

    await setup.execute({ ...mocks.input, filter: { categoryIds: ['cat-1'] } });

    expect(mocks.transactionRepository.sumDashboardRows).toHaveBeenCalledWith(
      expect.objectContaining({ categoryIds: ['cat-1', 'cat-2'] }),
    );
  });
});

describe('projected recurrences (spec 053)', () => {
  const future = { ...mocks.input, from: '2026-10-01', to: '2027-01-31' };

  it('SHOULD count a monthly occurrence as projected in every future month on its date', async () => {
    mocks.projections.executeChunked.mockResolvedValue(
      ['2026-11-10', '2026-12-10', '2027-01-10'].map((date) => mocks.occurrenceOf({ date })),
    );

    const rows = await setup.execute(future);

    expect(rows.map((row) => [row.bucketDate, row.amount, row.projected, row.categoryId])).toEqual([
      ['2026-11-10', 10000, true, 'cat-1'],
      ['2026-12-10', 10000, true, 'cat-1'],
      ['2027-01-10', 10000, true, 'cat-1'],
    ]);
    expect(mocks.projections.executeChunked).toHaveBeenCalledWith(
      expect.objectContaining({ from: '2026-11', to: '2027-01', today: '2026-10-20' }),
    );
  });

  it('SHOULD place a card occurrence on its invoice date AND drop it outside the period', async () => {
    mocks.projections.executeChunked.mockResolvedValue([
      mocks.occurrenceOf({
        creditCard: { id: 'card' },
        date: '2026-11-03',
        invoiceListDate: '2026-12-05',
      }),
      mocks.occurrenceOf({
        creditCard: { id: 'card' },
        date: '2027-01-28',
        invoiceListDate: '2027-02-05',
      }),
    ]);

    const rows = await setup.execute(future);

    expect(rows.map((row) => row.bucketDate)).toEqual(['2026-12-05']);
  });

  it('SHOULD start the projections at the first month after today even for an earlier period', async () => {
    await setup.execute({ ...future, from: '2026-05-01' });

    expect(mocks.projections.executeChunked).toHaveBeenCalledWith(
      expect.objectContaining({ from: '2026-11' }),
    );
  });

  it('SHOULD ask for nothing WHEN paid = true OR the period ends this month', async () => {
    await setup.execute({ ...future, filter: { paid: true } });
    await setup.execute(mocks.input);

    expect(mocks.projections.executeChunked).not.toHaveBeenCalled();
  });

  it('SHOULD follow the source AND the currency', async () => {
    mocks.projections.executeChunked.mockResolvedValue([
      mocks.occurrenceOf({ creditCard: { id: 'card' }, invoiceListDate: '2026-12-05' }),
      mocks.occurrenceOf({ date: '2026-11-11' }),
      mocks.occurrenceOf({ currency: 'USD', date: '2026-11-12' }),
    ]);

    const accountOnly = await setup.execute({ ...future, filter: { source: 'ACCOUNT' as never } });
    const cardOnly = await setup.execute({ ...future, filter: { source: 'CARD' as never } });

    expect(accountOnly.map((row) => row.bucketDate)).toEqual(['2026-11-11']);
    expect(cardOnly.map((row) => row.bucketDate)).toEqual(['2026-12-05']);
  });

  it('SHOULD split by tag with byTag AND forward the filters', async () => {
    mocks.projections.executeChunked.mockResolvedValue([
      mocks.occurrenceOf({ tags: [{ id: 't1' }, { id: 't2' }] }),
      mocks.occurrenceOf({ date: '2026-11-11' }),
    ]);

    const rows = await setup.execute({
      ...future,
      byTag: true,
      filter: { accountIds: ['a1'], categoryIds: ['c1'], q: 'rent', tagIds: ['t1'] },
    });

    expect(rows.map((row) => row.tagId)).toEqual(['t1', 't2', null]);
    expect(mocks.projections.executeChunked).toHaveBeenCalledWith(
      expect.objectContaining({
        filter: expect.objectContaining({
          accountIds: ['a1'],
          categoryIds: ['c1'],
          q: 'rent',
          tagIds: ['t1'],
        }),
      }),
    );
  });
});

describe('search by notes, category and amount (spec 059)', () => {
  it('SHOULD hand the SQL the matching category ids AND the amount range of the query', async () => {
    mocks.resolveSearch.execute.mockResolvedValue(['c1', 'c2']);

    await setup.execute({ ...mocks.input, filter: { q: '38,7' } });

    expect(mocks.transactionRepository.sumDashboardRows).toHaveBeenCalledWith(
      expect.objectContaining({
        amountRange: { maxCents: 3879, minCents: 3870 },
        q: '38,7',
        searchCategoryIds: ['c1', 'c2'],
      }),
    );
  });

  it('SHOULD send neither WHEN there is no text filter', async () => {
    await setup.execute({ ...mocks.input });

    expect(mocks.resolveSearch.execute).not.toHaveBeenCalled();
    expect(mocks.transactionRepository.sumDashboardRows).toHaveBeenCalledWith(
      expect.objectContaining({ amountRange: undefined, searchCategoryIds: undefined }),
    );
  });
});
