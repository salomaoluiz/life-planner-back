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
    expect(
      await setup.execute({
        ...base,
        filter: { from: '2026-11-01', q: 'nothing', to: '2026-11-30' },
      }),
    ).toEqual([]);
  });

  it('SHOULD match the text ignoring accents AND the tags by id', async () => {
    const tagged = { ...other, tags: [{ id: 'tag-1', name: 'fixo' }] };

    mocks.transactionRepository.findCardPurchases.mockResolvedValue([matching, tagged]);

    const byText = await setup.execute({
      ...base,
      filter: { from: '2026-11-01', q: 'mercadao', to: '2026-11-30' },
    });
    const byTag = await setup.execute({
      ...base,
      filter: { from: '2026-11-01', tagIds: ['tag-1'], to: '2026-11-30' },
    });

    expect(byText[0].purchases).toEqual([matching]);
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

  it('SHOULD match a purchase by its notes, its category name or its amount', async () => {
    const noted = { ...matching, categoryId: 'cat-x', notes: 'Presente da Ana', value: 1234 };
    const plain = { ...other, categoryId: 'cat-y', notes: null, value: 999 };

    mocks.transactionRepository.findCardPurchases.mockResolvedValue([noted, plain]);
    const byNotes = await setup.execute({
      ...base,
      filter: { from: '2026-11-01', q: 'presente', to: '2026-11-30' },
    });
    mocks.resolveSearch.execute.mockResolvedValue(['cat-y']);
    const byCategory = await setup.execute({
      ...base,
      filter: { from: '2026-11-01', q: 'lazer', to: '2026-11-30' },
    });
    mocks.resolveSearch.execute.mockResolvedValue([]);
    const byAmount = await setup.execute({
      ...base,
      filter: { from: '2026-11-01', q: '12,34', to: '2026-11-30' },
    });

    expect(byNotes[0].purchases).toEqual([noted]);
    expect(byCategory[0].purchases).toEqual([plain]);
    expect(byAmount[0].purchases).toEqual([noted]);
  });
});
