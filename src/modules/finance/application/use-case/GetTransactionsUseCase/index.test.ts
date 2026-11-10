import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { mocks, setup } from './index.mocks';

it('SHOULD return the repository result as-is (the repository already sorts date desc, createdAt desc)', async () => {
  const result = await setup.execute({ accessibleOwners: mocks.accessibleOwners });

  expect(mocks.transactionRepository.findTransactions).toHaveBeenCalledWith(
    mocks.accessibleOwners,
    'ACCOUNT',
    { creditCardId: undefined, invoiceMonth: undefined, limit: 200 },
  );
  expect(result).toEqual({ items: mocks.transactions, nextCursor: null });
});

it('SHOULD narrow to the requested ownerIds', async () => {
  await setup.execute({ accessibleOwners: mocks.accessibleOwners, ownerIds: ['family-id'] });

  expect(mocks.transactionRepository.findTransactions).toHaveBeenCalledWith(
    [{ owner: OwnerType.FAMILY, ownerId: 'family-id' }],
    'ACCOUNT',
    { creditCardId: undefined, invoiceMonth: undefined, limit: 200 },
  );
});

it('SHOULD return [] WITHOUT querying WHEN no requested id is accessible (never an error)', async () => {
  expect(
    await setup.execute({ accessibleOwners: mocks.accessibleOwners, ownerIds: ['stranger'] }),
  ).toEqual({ items: [], nextCursor: null });
  expect(mocks.transactionRepository.findTransactions).not.toHaveBeenCalled();
});

it('SHOULD return [] WHEN the owners have no transactions', async () => {
  mocks.transactionRepository.findTransactions.mockResolvedValueOnce([]);

  expect(await setup.execute({ accessibleOwners: mocks.accessibleOwners })).toEqual({
    items: [],
    nextCursor: null,
  });
});

it('SHOULD pass the CARD source and its filters through', async () => {
  await setup.execute({
    accessibleOwners: mocks.accessibleOwners,
    creditCardId: 'card-1',
    invoiceMonth: '2026-10',
    source: 'CARD' as never,
  });

  expect(mocks.transactionRepository.findTransactions).toHaveBeenCalledWith(
    mocks.accessibleOwners,
    'CARD',
    { creditCardIds: ['card-1'], invoiceMonth: '2026-10', limit: 200 },
  );
});

describe('filters (spec 045)', () => {
  it('SHOULD pass the expanded categories, tags, accounts, paid and period to the repository', async () => {
    mocks.expand.execute.mockResolvedValue(['market', 'greens']);

    await setup.execute({
      accessibleOwners: mocks.accessibleOwners,
      filter: {
        accountIds: ['acc-1'],
        categoryIds: ['market'],
        from: '2025-01-01',
        paid: false,
        tagIds: ['tag-1', 'tag-2'],
        to: '2025-12-31',
      },
    });

    expect(mocks.transactionRepository.findTransactions).toHaveBeenCalledWith(
      mocks.accessibleOwners,
      'ACCOUNT',
      {
        accountIds: ['acc-1'],
        categoryIds: ['market', 'greens'],
        from: '2025-01-01',
        limit: 200,
        paid: false,
        tagIds: ['tag-1', 'tag-2'],
        to: '2025-12-31',
      },
    );
  });

  it('SHOULD pass the projected filter to the repository (spec 096)', async () => {
    await setup.execute({ accessibleOwners: mocks.accessibleOwners, filter: { projected: true } });

    expect(mocks.transactionRepository.findTransactions).toHaveBeenCalledWith(
      mocks.accessibleOwners,
      'ACCOUNT',
      expect.objectContaining({ projected: true }),
    );
  });

  it('SHOULD pass the transfer kind filter to the repository (spec 098)', async () => {
    await setup.execute({ accessibleOwners: mocks.accessibleOwners, filter: { kind: 'TRANSFER' } });

    expect(mocks.transactionRepository.findTransactions).toHaveBeenCalledWith(
      mocks.accessibleOwners,
      'ACCOUNT',
      expect.objectContaining({ kind: 'TRANSFER' }),
    );
  });

  it('SHOULD hand the text to the repository as search terms AND return its rows as they are', async () => {
    const rows = [{ description: 'MERCADÃO' }];
    mocks.transactionRepository.findTransactions.mockResolvedValue(rows);

    const result = await setup.execute({
      accessibleOwners: mocks.accessibleOwners,
      filter: { q: ' mercadao ' },
    });

    expect(mocks.transactionRepository.findTransactions.mock.calls[0][2]).toEqual(
      expect.objectContaining({ limit: 200, search: { categoryIds: [], text: 'mercadao' } }),
    );
    expect(result.items).toEqual(rows);
  });

  it('SHOULD place CARD rows in the period by the invoices listed in it', async () => {
    mocks.findInvoices.executeWithData.mockResolvedValue({
      data: [{ card: { id: 'card-1' } }],
      matches: [{ card: { id: 'card-1' }, invoice: { referenceMonth: '2026-10' } }],
    });

    const page = await setup.execute({
      accessibleOwners: mocks.accessibleOwners,
      filter: { from: '2026-11-01', to: '2026-11-30' },
      source: 'CARD' as never,
      today: '2026-10-15',
    });

    expect(mocks.transactionRepository.findTransactions).toHaveBeenCalledWith(
      mocks.accessibleOwners,
      'CARD',
      expect.objectContaining({
        invoiceRefs: [{ creditCardId: 'card-1', invoiceMonth: '2026-10' }],
      }),
    );
    // Spec 083: the invoices computed to place the rows travel with the page.
    expect(page.invoiceData).toEqual([{ card: { id: 'card-1' } }]);
  });

  it('SHOULD return [] WHEN no invoice is listed in the period', async () => {
    expect(
      await setup.execute({
        accessibleOwners: mocks.accessibleOwners,
        filter: { from: '2026-11-01', to: '2026-11-30' },
        source: 'CARD' as never,
      }),
    ).toEqual({ items: [], nextCursor: null });
    expect(mocks.transactionRepository.findTransactions).not.toHaveBeenCalled();
  });
});

describe('search by notes, category and amount (spec 059, in SQL since spec 084)', () => {
  function searchOf() {
    return mocks.transactionRepository.findTransactions.mock.calls[0][2].search;
  }

  it('SHOULD send the categories resolved from the name (ancestors included)', async () => {
    mocks.resolveSearch.execute.mockResolvedValue(['c-food']);

    await setup.execute({ accessibleOwners: mocks.accessibleOwners, filter: { q: 'alimentacao' } });

    expect(mocks.resolveSearch.execute).toHaveBeenCalledWith(
      expect.objectContaining({ accessibleOwners: mocks.accessibleOwners, q: 'alimentacao' }),
    );
    expect(searchOf()).toEqual({ categoryIds: ['c-food'], text: 'alimentacao' });
  });

  it('SHOULD send the amount range: 38,70 exactly, 38 as 38,00 to 38,99', async () => {
    await setup.execute({ accessibleOwners: mocks.accessibleOwners, filter: { q: '38,70' } });
    expect(searchOf()).toEqual(expect.objectContaining({ amountMax: 3870, amountMin: 3870 }));

    mocks.transactionRepository.findTransactions.mockClear();
    await setup.execute({ accessibleOwners: mocks.accessibleOwners, filter: { q: '38' } });
    expect(searchOf()).toEqual(expect.objectContaining({ amountMax: 3899, amountMin: 3800 }));
  });

  it('SHOULD NOT search NOR resolve categories WHEN there is no text', async () => {
    await setup.execute({ accessibleOwners: mocks.accessibleOwners });

    expect(mocks.resolveSearch.execute).not.toHaveBeenCalled();
    expect(searchOf()).toBeUndefined();
  });
});

function cursorOf(date: string, createdAt: string, id: string) {
  return Buffer.from(`${date}|${createdAt}|${id}`).toString('base64');
}
function row(id: string, date: string, createdAt: string) {
  return {
    createdAt: new Date(createdAt),
    date,
    description: id,
    id,
    notes: null,
    value: 100,
  } as never;
}

describe('keyset pages (spec 078)', () => {
  it('SHOULD cut limit rows and return the cursor of the last one WHEN the repository returns limit + 1', async () => {
    mocks.transactionRepository.findTransactions.mockResolvedValue([
      row('c', '2026-11-03', '2026-11-03T10:00:00.000Z'),
      row('b', '2026-11-02', '2026-11-02T10:00:00.000Z'),
      row('a', '2026-11-01', '2026-11-01T10:00:00.000Z'),
    ]);

    const result = await setup.execute({ accessibleOwners: mocks.accessibleOwners, limit: 2 });

    expect(result.items.map((item) => item.id)).toEqual(['c', 'b']);
    expect(result.nextCursor).toBe(cursorOf('2026-11-02', '2026-11-02T10:00:00.000Z', 'b'));
    expect(mocks.transactionRepository.findTransactions).toHaveBeenCalledWith(
      mocks.accessibleOwners,
      'ACCOUNT',
      expect.objectContaining({ limit: 2 }),
    );
  });

  it('SHOULD pass the decoded cursor to the repository', async () => {
    await setup.execute({
      accessibleOwners: mocks.accessibleOwners,
      cursor: cursorOf('2026-11-02', '2026-11-02T10:00:00.000Z', 'b'),
    });

    expect(mocks.transactionRepository.findTransactions).toHaveBeenCalledWith(
      mocks.accessibleOwners,
      'ACCOUNT',
      expect.objectContaining({
        cursor: {
          createdAt: new Date('2026-11-02T10:00:00.000Z'),
          date: new Date('2026-11-02T00:00:00.000Z'),
          id: 'b',
        },
      }),
    );
  });

  it('SHOULD page the search in SQL: cursor and limit go to the repository, a full page gets its cursor', async () => {
    mocks.transactionRepository.findTransactions.mockResolvedValue([
      row('mercado-3', '2026-11-05', '2026-11-05T10:00:00.000Z'),
      row('mercado-2', '2026-11-03', '2026-11-03T10:00:00.000Z'),
      row('mercado-1', '2026-11-02', '2026-11-02T10:00:00.000Z'),
    ]);

    const first = await setup.execute({
      accessibleOwners: mocks.accessibleOwners,
      filter: { q: 'mercado' },
      limit: 2,
    });

    expect(mocks.transactionRepository.findTransactions.mock.calls[0][2]).toEqual(
      expect.objectContaining({ cursor: undefined, limit: 2 }),
    );
    expect(first.items.map((item) => item.id)).toEqual(['mercado-3', 'mercado-2']);
    expect(first.nextCursor).not.toBeNull();

    await setup.execute({
      accessibleOwners: mocks.accessibleOwners,
      cursor: first.nextCursor ?? undefined,
      filter: { q: 'mercado' },
      limit: 2,
    });

    expect(mocks.transactionRepository.findTransactions.mock.calls[1][2].cursor).toEqual(
      expect.objectContaining({ id: 'mercado-2' }),
    );
  });
});

describe('categories read once (spec 083)', () => {
  const categories = [{ id: 'market' }, { id: 'greens', parentId: 'market' }] as never;

  it('SHOULD load the categories ONCE AND hand them to the expansion AND the search', async () => {
    mocks.loadCategories.execute.mockResolvedValue(categories);

    await setup.execute({
      accessibleOwners: mocks.accessibleOwners,
      filter: { categoryIds: ['market'], q: 'rent' },
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
      accessibleOwners: mocks.accessibleOwners,
      filter: { categoryIds: ['market'], q: 'rent' },
      preloaded: { categories },
    });

    expect(mocks.loadCategories.execute).not.toHaveBeenCalled();
    expect(mocks.expand.execute).toHaveBeenCalledWith(
      expect.objectContaining({ preloaded: { categories } }),
    );
  });
});

it('SHOULD forward the currency to the repository (spec 103)', async () => {
  await setup.execute({ accessibleOwners: mocks.accessibleOwners, filter: { currency: 'USD' } });

  expect(mocks.transactionRepository.findTransactions).toHaveBeenCalledWith(
    mocks.accessibleOwners,
    'ACCOUNT',
    expect.objectContaining({ currency: 'USD' }),
  );
});
