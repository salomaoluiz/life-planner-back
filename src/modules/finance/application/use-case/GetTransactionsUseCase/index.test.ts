import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { mocks, setup } from './index.mocks';

it('SHOULD return the repository result as-is (the repository already sorts date desc, createdAt desc)', async () => {
  const result = await setup.execute({ accessibleOwners: mocks.accessibleOwners });

  expect(mocks.transactionRepository.findTransactions).toHaveBeenCalledWith(
    mocks.accessibleOwners,
    'ACCOUNT',
    { creditCardId: undefined, invoiceMonth: undefined },
  );
  expect(result).toBe(mocks.transactions);
});

it('SHOULD narrow to the requested ownerIds', async () => {
  await setup.execute({ accessibleOwners: mocks.accessibleOwners, ownerIds: ['family-id'] });

  expect(mocks.transactionRepository.findTransactions).toHaveBeenCalledWith(
    [{ owner: OwnerType.FAMILY, ownerId: 'family-id' }],
    'ACCOUNT',
    { creditCardId: undefined, invoiceMonth: undefined },
  );
});

it('SHOULD return [] WITHOUT querying WHEN no requested id is accessible (never an error)', async () => {
  expect(
    await setup.execute({ accessibleOwners: mocks.accessibleOwners, ownerIds: ['stranger'] }),
  ).toEqual([]);
  expect(mocks.transactionRepository.findTransactions).not.toHaveBeenCalled();
});

it('SHOULD return [] WHEN the owners have no transactions', async () => {
  mocks.transactionRepository.findTransactions.mockResolvedValueOnce([]);

  expect(await setup.execute({ accessibleOwners: mocks.accessibleOwners })).toEqual([]);
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
    { creditCardIds: ['card-1'], invoiceMonth: '2026-10' },
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
        paid: false,
        tagIds: ['tag-1', 'tag-2'],
        to: '2025-12-31',
      },
    );
  });

  it('SHOULD keep the rows whose description contains the text, ignoring case and accents', async () => {
    mocks.transactionRepository.findTransactions.mockResolvedValue([
      { description: 'MERCADÃO' },
      { description: 'Farmácia' },
    ]);

    const result = await setup.execute({
      accessibleOwners: mocks.accessibleOwners,
      filter: { q: 'mercadao' },
    });

    expect(result).toEqual([{ description: 'MERCADÃO' }]);
  });

  it('SHOULD place CARD rows in the period by the invoices listed in it', async () => {
    mocks.findInvoices.execute.mockResolvedValue([
      { card: { id: 'card-1' }, invoice: { referenceMonth: '2026-10' } },
    ]);

    await setup.execute({
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
  });

  it('SHOULD return [] WHEN no invoice is listed in the period', async () => {
    expect(
      await setup.execute({
        accessibleOwners: mocks.accessibleOwners,
        filter: { from: '2026-11-01', to: '2026-11-30' },
        source: 'CARD' as never,
      }),
    ).toEqual([]);
    expect(mocks.transactionRepository.findTransactions).not.toHaveBeenCalled();
  });
});

describe('search by notes, category and amount (spec 059)', () => {
  const rows = [
    { categoryId: 'c-ride', description: 'Uber', notes: 'Casa → Aeroporto', value: 3870 },
    { categoryId: 'c-food', description: 'Padaria', notes: null, value: 2240 },
    { categoryId: 'c-food', description: 'Pizza', notes: null, value: 3899 },
  ];

  beforeEach(() => {
    mocks.transactionRepository.findTransactions.mockResolvedValue(rows);
  });

  it('SHOULD match the notes', async () => {
    const result = await setup.execute({
      accessibleOwners: mocks.accessibleOwners,
      filter: { q: 'aeroporto' },
    });

    expect(result).toEqual([rows[0]]);
  });

  it('SHOULD match the categories resolved from the name (ancestors included)', async () => {
    mocks.resolveSearch.execute.mockResolvedValue(['c-food']);

    const result = await setup.execute({
      accessibleOwners: mocks.accessibleOwners,
      filter: { q: 'alimentacao' },
    });

    expect(mocks.resolveSearch.execute).toHaveBeenCalledWith({
      accessibleOwners: mocks.accessibleOwners,
      q: 'alimentacao',
    });
    expect(result).toEqual([rows[1], rows[2]]);
  });

  it('SHOULD match the amount: 38,70 exactly, 38 as 38,00 to 38,99', async () => {
    const exact = await setup.execute({
      accessibleOwners: mocks.accessibleOwners,
      filter: { q: '38,70' },
    });
    const whole = await setup.execute({
      accessibleOwners: mocks.accessibleOwners,
      filter: { q: '38' },
    });

    expect(exact).toEqual([rows[0]]);
    expect(whole).toEqual([rows[0], rows[2]]);
  });

  it('SHOULD NOT resolve categories WHEN there is no text filter', async () => {
    await setup.execute({ accessibleOwners: mocks.accessibleOwners });

    expect(mocks.resolveSearch.execute).not.toHaveBeenCalled();
  });
});
