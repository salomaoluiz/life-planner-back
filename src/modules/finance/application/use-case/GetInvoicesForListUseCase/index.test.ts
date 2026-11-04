import { mocks, setup } from './index.mocks';

it('SHOULD return the October invoice in NOVEMBER (planned payment day 05/11) with its purchases', async () => {
  const result = await setup.execute(mocks.input);

  expect(result).toHaveLength(1);
  expect(result[0].invoice).toMatchObject({ amount: 45000, listDate: '2026-11-05' });
  expect(result[0].purchases).toEqual([mocks.purchase]);
  expect(mocks.transactionRepository.findCardPurchases).toHaveBeenCalledTimes(1);
});

it('SHOULD NOT return it in October while it is unpaid', async () => {
  expect(await setup.execute({ ...mocks.input, month: '2026-10' })).toEqual([]);
  expect(mocks.transactionRepository.findCardPurchases).not.toHaveBeenCalled();
});

it('SHOULD move the line to the real payment day once paid (October, not November)', async () => {
  mocks.compute.execute.mockResolvedValue([
    { card: mocks.card, invoices: {}, payments: [mocks.payment], totals: mocks.totals },
  ]);

  expect(await setup.execute({ ...mocks.input, month: '2026-10' })).toHaveLength(1);
  expect(await setup.execute(mocks.input)).toEqual([]);
});

it('SHOULD skip invoices with amount 0', async () => {
  mocks.compute.execute.mockResolvedValue([
    {
      card: mocks.card,
      invoices: {},
      payments: [],
      totals: [{ amount: 0, invoiceMonth: '2026-10' }],
    },
  ]);

  expect(await setup.execute(mocks.input)).toEqual([]);
});

it('SHOULD return [] WITHOUT querying WHEN no requested owner is accessible', async () => {
  expect(await setup.execute({ ...mocks.input, ownerIds: ['stranger'] })).toEqual([]);
  expect(mocks.creditCardRepository.findCreditCards).not.toHaveBeenCalled();
});

it('SHOULD reject a malformed month', async () => {
  await expect(setup.execute({ ...mocks.input, month: '2026-1' })).rejects.toThrow();
});

it('SHOULD keep an invoice fully paid early (amount 0) AND drop a negative one without early payments', async () => {
  mocks.compute.execute.mockResolvedValue([
    {
      card: mocks.card,
      invoices: {},
      payments: [],
      totals: [{ amount: 0, earlyPaid: 45000, invoiceMonth: '2026-10' }],
    },
  ]);

  expect(await setup.execute(mocks.input)).toHaveLength(1);

  mocks.compute.execute.mockResolvedValue([
    {
      card: mocks.card,
      invoices: {},
      payments: [],
      totals: [{ amount: -500, invoiceMonth: '2026-10' }],
    },
  ]);

  expect(await setup.execute(mocks.input)).toEqual([]);
});

describe('filters (spec 045)', () => {
  const base = { accessibleOwners: mocks.input.accessibleOwners, today: mocks.input.today };
  const matching = {
    ...mocks.purchase,
    categoryId: 'market',
    description: 'MERCADÃO',
    id: 'p-1',
    value: 10000,
  };
  const other = {
    ...mocks.purchase,
    categoryId: 'home',
    description: 'Rent',
    id: 'p-2',
    value: 35000,
  };

  beforeEach(() => {
    mocks.transactionRepository.findCardPurchases.mockResolvedValue([matching, other]);
  });

  it('SHOULD select the invoices by period AND keep only the matching rows with their totals', async () => {
    const result = await setup.execute({
      ...base,
      filter: { categoryIds: ['market'], from: '2026-11-01', to: '2026-11-30' },
    });

    expect(result).toHaveLength(1);
    expect(result[0].purchases).toEqual([matching]);
    expect(result[0].filtered).toEqual({ filteredTotal: 10000, matchedCount: 1, purchaseCount: 2 });
    expect(result[0].invoice.amount).toBe(45000);
  });

  it('SHOULD omit an invoice with no matching row', async () => {
    mocks.transactionRepository.findCardPurchases.mockResolvedValue([]);

    expect(
      await setup.execute({
        ...base,
        filter: { from: '2026-11-01', q: 'nothing', to: '2026-11-30' },
      }),
    ).toEqual([]);
  });

  it('SHOULD search in SQL: terms go to the repository, its rows are not re-matched, the count is the whole invoice', async () => {
    mocks.resolveSearch.execute.mockResolvedValue(['home']);
    mocks.transactionRepository.findCardPurchases.mockResolvedValue([matching]);

    const result = await setup.execute({
      ...base,
      filter: { from: '2026-11-01', q: '12,34', to: '2026-11-30' },
    });

    expect(mocks.transactionRepository.findCardPurchases).toHaveBeenCalledWith(expect.any(Array), {
      amountMax: 1234,
      amountMin: 1234,
      categoryIds: ['home'],
      text: '12,34',
    });
    expect(result[0].purchases).toEqual([matching]);
    expect(result[0].filtered).toEqual({ filteredTotal: 10000, matchedCount: 1, purchaseCount: 2 });
  });

  it('SHOULD NOT count the purchases separately WHEN there is no text', async () => {
    await setup.execute({
      ...base,
      filter: { categoryIds: ['market'], from: '2026-11-01', to: '2026-11-30' },
    });

    expect(mocks.transactionRepository.findCardPurchases).toHaveBeenCalledWith(
      expect.any(Array),
      undefined,
    );
    expect(mocks.transactionRepository.countCardPurchasesByInvoice).not.toHaveBeenCalled();
  });

  it('SHOULD filter the tags by id in memory', async () => {
    const tagged = { ...other, tags: [{ id: 'tag-1', name: 'fixo' }] };

    mocks.transactionRepository.findCardPurchases.mockResolvedValue([matching, tagged]);

    const byTag = await setup.execute({
      ...base,
      filter: { from: '2026-11-01', tagIds: ['tag-1'], to: '2026-11-30' },
    });

    expect(byTag[0].purchases).toEqual([tagged]);
  });

  it('SHOULD apply paid to the invoice', async () => {
    const filter = { from: '2026-11-01', paid: true, to: '2026-11-30' };

    expect(await setup.execute({ ...base, filter })).toEqual([]);
    expect(await setup.execute({ ...base, filter: { ...filter, paid: false } })).toHaveLength(1);
  });

  it('SHOULD reject month together with a period, or neither', async () => {
    await expect(
      setup.execute({ ...mocks.input, filter: { from: '2026-11-01', to: '2026-11-30' } }),
    ).rejects.toThrow();
    await expect(setup.execute(base)).rejects.toThrow();
  });
});

describe('categories read once (spec 083)', () => {
  const categories = [{ id: 'market' }, { id: 'greens', parentId: 'market' }] as never;

  it('SHOULD load the categories ONCE AND hand them to the expansion AND the search', async () => {
    mocks.loadCategories.execute.mockResolvedValue(categories);

    await setup.execute({
      accessibleOwners: mocks.input.accessibleOwners,
      filter: { categoryIds: ['market'], from: '2026-11-01', q: 'rent', to: '2026-11-30' },
      today: mocks.input.today,
    });

    expect(mocks.loadCategories.execute).toHaveBeenCalledTimes(1);
    expect(mocks.expand.execute).toHaveBeenCalledWith(
      expect.objectContaining({ preloaded: { categories } }),
    );
    expect(mocks.resolveSearch.execute).toHaveBeenCalledWith(
      expect.objectContaining({ preloaded: { categories } }),
    );
  });

  it('SHOULD NOT load them WHEN the caller passes them preloaded', async () => {
    await setup.execute({
      accessibleOwners: mocks.input.accessibleOwners,
      filter: { categoryIds: ['market'], from: '2026-11-01', q: 'rent', to: '2026-11-30' },
      preloaded: { categories },
      today: mocks.input.today,
    });

    expect(mocks.loadCategories.execute).not.toHaveBeenCalled();
    expect(mocks.expand.execute).toHaveBeenCalledWith(
      expect.objectContaining({ preloaded: { categories } }),
    );
  });
});
