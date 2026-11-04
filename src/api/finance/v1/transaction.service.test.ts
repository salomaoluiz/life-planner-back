import TransactionEntityFixture from '@finance/domain/entity/mocks/TransactionEntity.fixture';
import { SystemCategoryKey, TransactionType } from '@finance/domain/enum';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { mocks, setup } from './transaction.service.mocks';

describe('create', () => {
  it('SHOULD add the accessible owners AND return the API shape with embedded summaries and ISO dates', async () => {
    const body = {
      accountId: mocks.transactionItem.accountId,
      categoryId: mocks.transactionItem.categoryId,
      date: '2026-10-03',
      description: 'Weekly groceries',
      owner: OwnerType.USER,
      ownerId: mocks.userId,
      type: TransactionType.EXPENSE,
      value: 23490,
    };

    const result = await setup.create(mocks.userId, body, '2026-10-15');

    expect(mocks.createTransactionUseCase.execute).toHaveBeenCalledWith({
      ...body,
      accessibleOwners: mocks.accessibleOwners,
      today: '2026-10-15',
    });
    expect(result).toEqual(mocks.transactionApi);
    expect(result.item.date).toBe('2026-10-03');
  });
});

describe('findAll', () => {
  it('SHOULD forward ownerIds AND map every transaction', async () => {
    const result = await setup.findAll(mocks.userId, ['o1']);

    expect(mocks.getTransactionsUseCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({ accessibleOwners: mocks.accessibleOwners, ownerIds: ['o1'] }),
    );
    expect(result).toEqual({
      items: [mocks.transactionItem],
      lookups: mocks.transactionLookups,
      nextCursor: null,
    });
  });

  it('SHOULD forward cursor and limit AND return the next cursor of the page (spec 078)', async () => {
    mocks.getTransactionsUseCase.execute.mockResolvedValueOnce({ items: [], nextCursor: 'next' });

    const result = await setup.findAll(mocks.userId, undefined, { cursor: 'c', limit: 50 });

    expect(mocks.getTransactionsUseCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: 'c', limit: 50 }),
    );
    expect(result).toEqual({
      items: [],
      lookups: { accounts: {}, categories: {}, creditCards: {}, tags: {} },
      nextCursor: 'next',
    });
  });

  it('SHOULD forward the filter AND the paid choice to the card resolver (spec 045)', async () => {
    await setup.findAll(mocks.userId, undefined, { filter: { paid: false, q: 'a' } }, '2026-10-15');

    expect(mocks.getTransactionsUseCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({ filter: { paid: false, q: 'a' }, today: '2026-10-15' }),
    );
    expect(mocks.resolveCardRowsPaidUseCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({ paid: false }),
    );
  });
});

describe('findById (spec 077)', () => {
  it('SHOULD read the row with the accessible owners AND map it to the API shape', async () => {
    const result = await setup.findById(mocks.userId, mocks.transactionResult.id, '2026-10-15');

    expect(mocks.getTransactionByIdUseCase.execute).toHaveBeenCalledWith({
      accessibleOwners: mocks.accessibleOwners,
      id: mocks.transactionResult.id,
    });
    expect(result).toEqual(mocks.transactionApi);
  });

  it('SHOULD return the resolved paid status of a card row', async () => {
    mocks.resolveCardRowsPaidUseCase.execute.mockResolvedValueOnce([
      { ...mocks.transactionResult, paid: false },
    ]);

    const result = await setup.findById(mocks.userId, mocks.transactionResult.id, '2026-10-15');

    expect(mocks.resolveCardRowsPaidUseCase.execute).toHaveBeenCalledWith({
      today: '2026-10-15',
      transactions: [mocks.transactionResult],
    });
    expect(result.item.paid).toBe(false);
  });

  it('SHOULD propagate the not found of the use case', async () => {
    mocks.getTransactionByIdUseCase.execute.mockRejectedValueOnce(new Error('404'));

    await expect(setup.findById(mocks.userId, 'x')).rejects.toThrow('404');
  });
});

describe('update', () => {
  it('SHOULD forward the id and the patch', async () => {
    await setup.update(mocks.userId, 'tx-1', { value: 100 }, '2026-10-15');

    expect(mocks.updateTransactionUseCase.execute).toHaveBeenCalledWith({
      accessibleOwners: mocks.accessibleOwners,
      id: 'tx-1',
      today: '2026-10-15',
      value: 100,
    });
  });
});

describe('delete', () => {
  it('SHOULD call the use case with the accessible owners', async () => {
    await setup.delete(mocks.userId, 'tx-1');

    expect(mocks.deleteTransactionUseCase.execute).toHaveBeenCalledWith({
      accessibleOwners: mocks.accessibleOwners,
      id: 'tx-1',
      scope: undefined,
    });
  });
});

describe('system categories (spec 028)', () => {
  it('SHOULD expose the system key AND excludeFromTotals of a balance adjustment', async () => {
    mocks.getTransactionsUseCase.execute.mockResolvedValueOnce({
      items: [new TransactionEntityFixture().withBalanceAdjustment().build()],
      nextCursor: null,
    });

    const {
      items: [result],
      lookups,
    } = await setup.findAll(mocks.userId);

    expect(result.categoryId).toBeDefined();
    expect(Object.values(lookups.categories)).toEqual([
      expect.objectContaining({
        excludeFromTotals: true,
        systemKey: SystemCategoryKey.BALANCE_ADJUSTMENT,
      }),
    ]);
  });
});

describe('card purchases (spec 029)', () => {
  const cardPurchase = {
    ...mocks.transactionResult,
    account: null,
    accountId: null,
    creditCard: { color: '#2B3A8C', id: 'card-1', lastDigits: '1234', title: 'Main card' },
    creditCardId: 'card-1',
    invoiceMonth: '2026-10',
  };

  it('SHOULD map a card purchase (no account) AND carry overLimit from the use case', async () => {
    mocks.createTransactionUseCase.execute.mockResolvedValueOnce({
      overLimit: true,
      transaction: cardPurchase,
    });

    const result = await setup.create(mocks.userId, {
      categoryId: cardPurchase.categoryId,
      creditCardId: 'card-1',
      date: '2026-10-03',
      description: 'Market',
      owner: OwnerType.USER,
      ownerId: mocks.userId,
      type: TransactionType.EXPENSE,
      value: 100,
    });

    expect(result.item).toMatchObject({
      creditCardId: 'card-1',
      invoiceMonth: '2026-10',
      overLimit: true,
    });
    expect(JSON.parse(JSON.stringify(result.item))).not.toHaveProperty('accountId');
    expect(result.lookups.accounts).toEqual({});
    expect(result.lookups.creditCards).toEqual({
      'card-1': { color: '#2B3A8C', lastDigits: '1234', title: 'Main card' },
    });
  });

  it('SHOULD omit overLimit for account rows AND forward source filters', async () => {
    expect((await setup.update(mocks.userId, 'tx-1', { value: 1 })).item.overLimit).toBeUndefined();

    await setup.findAll(mocks.userId, undefined, {
      invoiceMonth: '2026-10',
      source: 'CARD' as never,
    });

    expect(mocks.getTransactionsUseCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        accessibleOwners: mocks.accessibleOwners,
        invoiceMonth: '2026-10',
        ownerIds: undefined,
        source: 'CARD',
      }),
    );
  });
});

describe('paid status (spec 033)', () => {
  it('SHOULD expose paid AND use the status the card resolver returns', async () => {
    mocks.resolveCardRowsPaidUseCase.execute.mockResolvedValueOnce([
      { ...mocks.transactionResult, paid: false },
    ]);

    const {
      items: [result],
    } = await setup.findAll(mocks.userId, undefined, {}, '2026-10-15');

    expect(result.paid).toBe(false);
    expect(mocks.resolveCardRowsPaidUseCase.execute).toHaveBeenCalledWith({
      today: '2026-10-15',
      transactions: [mocks.transactionResult],
    });
  });

  it('SHOULD resolve the status of a created row', async () => {
    const result = await setup.create(mocks.userId, {} as never, '2026-10-15');

    expect(result.item.paid).toBe(true);
    expect(mocks.resolveCardRowsPaidUseCase.execute).toHaveBeenCalledTimes(1);
  });
});

describe('recurring transactions (spec 034)', () => {
  it('SHOULD materialize the recurring occurrences of the owners with today BEFORE reading the list', async () => {
    const order: string[] = [];

    mocks.materializeRecurrencesUseCase.execute.mockImplementationOnce(async () => {
      order.push('materialize');
    });
    mocks.getTransactionsUseCase.execute.mockImplementationOnce(async () => {
      order.push('read');

      return { items: [], nextCursor: null };
    });

    await setup.findAll(mocks.userId, ['o1'], {}, '2026-10-17');

    expect(order).toEqual(['materialize', 'read']);
    expect(mocks.materializeRecurrencesUseCase.execute).toHaveBeenCalledWith({
      accessibleOwners: mocks.accessibleOwners,
      ownerIds: ['o1'],
      today: '2026-10-17',
    });
  });

  it('SHOULD forward the delete scope', async () => {
    await setup.delete(mocks.userId, 'tx-1', 'ONLY_THIS' as never);

    expect(mocks.deleteTransactionUseCase.execute).toHaveBeenCalledWith({
      accessibleOwners: mocks.accessibleOwners,
      id: 'tx-1',
      scope: 'ONLY_THIS',
    });
  });
});

describe('lean payload (spec 079)', () => {
  function walk(value: unknown): unknown[] {
    return value !== null && typeof value === 'object'
      ? Object.values(value).flatMap((child) => [child, ...walk(child)])
      : [];
  }

  it('SHOULD carry no null, no timestamps and no nested entities in a response', async () => {
    const list = await setup.findAll(mocks.userId);
    const one = await setup.findById(mocks.userId, mocks.transactionResult.id);
    const json = JSON.parse(JSON.stringify({ list, one }));

    // `nextCursor: null` is the only null: it marks the last page.
    expect(walk({ ...json, list: { ...json.list, nextCursor: undefined } })).not.toContain(null);
    expect(JSON.stringify(json)).not.toMatch(/createdAt|updatedAt/);
    expect(json.list.items[0]).not.toHaveProperty('category');
    expect(json.list.items[0]).not.toHaveProperty('tags');
  });

  it('SHOULD leave out tagIds for a row without tags AND list a shared tag once', async () => {
    const withTags = { ...mocks.transactionResult, id: 'other-id' };
    const without = { ...mocks.transactionResult, tags: [] };
    mocks.resolveCardRowsPaidUseCase.execute.mockResolvedValueOnce([withTags, without]);

    const { items, lookups } = await setup.findAll(mocks.userId);

    expect(items[0].tagIds).toHaveLength(1);
    expect(JSON.parse(JSON.stringify(items[1]))).not.toHaveProperty('tagIds');
    expect(Object.keys(lookups.tags)).toHaveLength(1);
    expect(Object.keys(lookups.categories)).toHaveLength(1);
  });

  it('SHOULD return four empty maps for an empty page', async () => {
    mocks.resolveCardRowsPaidUseCase.execute.mockResolvedValueOnce([]);

    const { lookups } = await setup.findAll(mocks.userId);

    expect(lookups).toEqual({ accounts: {}, categories: {}, creditCards: {}, tags: {} });
  });
});

describe('invoices computed once (spec 083)', () => {
  const invoiceData = [{ card: { id: 'card-1' } }] as never;

  it('SHOULD hand the invoices of create AND update to the card resolver', async () => {
    mocks.createTransactionUseCase.execute.mockResolvedValueOnce({
      invoiceData,
      overLimit: false,
      transaction: mocks.transactionResult,
    });
    await setup.create(mocks.userId, {} as never, '2026-10-15');
    expect(mocks.resolveCardRowsPaidUseCase.execute).toHaveBeenLastCalledWith(
      expect.objectContaining({ invoiceData }),
    );

    mocks.updateTransactionUseCase.execute.mockResolvedValueOnce({
      invoiceData,
      overLimit: false,
      transaction: mocks.transactionResult,
    });
    await setup.update(mocks.userId, mocks.transactionResult.id, {} as never, '2026-10-15');
    expect(mocks.resolveCardRowsPaidUseCase.execute).toHaveBeenLastCalledWith(
      expect.objectContaining({ invoiceData }),
    );
  });

  it('SHOULD hand the invoices of the page to the card resolver', async () => {
    mocks.getTransactionsUseCase.execute.mockResolvedValueOnce({
      invoiceData,
      items: [mocks.transactionResult],
      nextCursor: null,
    });

    await setup.findAll(mocks.userId, undefined, {}, '2026-10-15');

    expect(mocks.resolveCardRowsPaidUseCase.execute).toHaveBeenLastCalledWith(
      expect.objectContaining({ invoiceData }),
    );
  });
});
