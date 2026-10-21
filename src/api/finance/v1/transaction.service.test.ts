import TransactionEntityFixture from '@finance/domain/entity/mocks/TransactionEntity.fixture';
import { SystemCategoryKey, TransactionType } from '@finance/domain/enum';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { mocks, setup } from './transaction.service.mocks';

describe('create', () => {
  it('SHOULD add the accessible owners AND return the API shape with embedded summaries and ISO dates', async () => {
    const body = {
      accountId: mocks.transactionApi.accountId,
      categoryId: mocks.transactionApi.categoryId,
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
    expect(result.account).toEqual({
      icon: 'bank',
      id: mocks.transactionApi.account?.id,
      name: 'Checking',
    });
    expect(result.category.iconColor).toBe('#2E7D32');
    expect(result.date).toBe('2026-10-03');
  });
});

describe('findAll', () => {
  it('SHOULD forward ownerIds AND map every transaction', async () => {
    const result = await setup.findAll(mocks.userId, ['o1']);

    expect(mocks.getTransactionsUseCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({ accessibleOwners: mocks.accessibleOwners, ownerIds: ['o1'] }),
    );
    expect(result).toEqual([mocks.transactionApi]);
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
    mocks.getTransactionsUseCase.execute.mockResolvedValueOnce([
      new TransactionEntityFixture().withBalanceAdjustment().build(),
    ]);

    const [result] = await setup.findAll(mocks.userId);

    expect(result.category.systemKey).toBe(SystemCategoryKey.BALANCE_ADJUSTMENT);
    expect(result.category.excludeFromTotals).toBe(true);
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

    expect(result).toMatchObject({
      account: null,
      accountId: null,
      creditCard: { id: 'card-1', title: 'Main card' },
      invoiceMonth: '2026-10',
      overLimit: true,
    });
  });

  it('SHOULD omit overLimit for account rows AND forward source filters', async () => {
    expect((await setup.update(mocks.userId, 'tx-1', { value: 1 })).overLimit).toBeUndefined();

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

    const [result] = await setup.findAll(mocks.userId, undefined, {}, '2026-10-15');

    expect(result.paid).toBe(false);
    expect(mocks.resolveCardRowsPaidUseCase.execute).toHaveBeenCalledWith({
      today: '2026-10-15',
      transactions: [mocks.transactionResult],
    });
  });

  it('SHOULD resolve the status of a created row', async () => {
    const result = await setup.create(mocks.userId, {} as never, '2026-10-15');

    expect(result.paid).toBe(true);
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

      return [];
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
