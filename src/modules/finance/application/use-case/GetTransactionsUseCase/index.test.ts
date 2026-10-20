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
