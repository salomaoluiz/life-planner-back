import { TransactionType } from '@finance/domain/enum';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { mocks, setup, spies } from './index.mocks';

describe('counts', () => {
  it('SHOULD delegate countByAccountId and countByCategoryIds', async () => {
    expect(await setup.countByAccountId('acc')).toBe(2);
    expect(await setup.countByCategoryIds(['c1'])).toBe(0);
    expect(mocks.transactionDatasource.countByAccountId).toHaveBeenCalledWith('acc');
    expect(mocks.transactionDatasource.countByCategoryIds).toHaveBeenCalledWith(['c1']);
  });
});

describe('createTransaction', () => {
  it('SHOULD translate to columns, turn the YYYY-MM-DD date into a UTC-midnight Date AND map the result', async () => {
    const result = await setup.createTransaction({
      accountId: 'acc',
      categoryId: 'cat',
      currency: 'BRL' as const,
      date: '2026-10-03',
      description: 'Lunch',
      owner: OwnerType.USER,
      ownerId: 'owner',
      type: TransactionType.EXPENSE,
      value: 4550,
    });

    expect(mocks.transactionDatasource.create).toHaveBeenCalledWith({
      account_id: 'acc',
      category_id: 'cat',
      currency: 'BRL' as const,
      date: new Date('2026-10-03T00:00:00.000Z'),
      description: 'Lunch',
      owner: 'USER',
      owner_id: 'owner',
      type: 'EXPENSE',
      value: 4550,
    });
    expect(spies.mapper.toDomain).toHaveBeenCalledWith(mocks.transactionPersistence);
    expect(result).toBe(mocks.transactionEntity);
  });
});

describe('deleteTransaction / existsByOwner', () => {
  it('SHOULD delegate to the datasource', async () => {
    await setup.deleteTransaction('id-1');
    const exists = await setup.existsByOwner({ owner: OwnerType.FAMILY, ownerId: 'fam' });

    expect(mocks.transactionDatasource.delete).toHaveBeenCalledWith('id-1');
    expect(mocks.transactionDatasource.exists).toHaveBeenCalledWith({
      owner: 'FAMILY',
      owner_id: 'fam',
    });
    expect(exists).toBe(true);
  });
});

describe('findTransactionById / findTransactions', () => {
  it('SHOULD map the row, or return undefined WHEN not found', async () => {
    expect(await setup.findTransactionById('id-1')).toBe(mocks.transactionEntity);

    mocks.transactionDatasource.findById.mockResolvedValueOnce(null);

    expect(await setup.findTransactionById('id-1')).toBeUndefined();
  });

  it('SHOULD map every row of the owners', async () => {
    const owners = [{ owner: OwnerType.USER, ownerId: 'u' }];

    expect(await setup.findTransactions(owners)).toEqual([mocks.transactionEntity]);
    expect(mocks.transactionDatasource.findByOwners).toHaveBeenCalledWith(owners, 'ACCOUNT', {});
  });

  it('SHOULD convert the invoice refs to the datasource keys (spec 045)', async () => {
    const owners = [{ owner: OwnerType.USER, ownerId: 'u' }];

    await setup.findTransactions(owners, 'CARD' as never, {
      invoiceRefs: [{ creditCardId: 'card-1', invoiceMonth: '2026-10' }],
      paid: false,
    });

    expect(mocks.transactionDatasource.findByOwners).toHaveBeenCalledWith(owners, 'CARD', {
      invoiceRefs: [{ credit_card_id: 'card-1', invoice_month: '2026-10' }],
      paid: false,
    });
  });
});

describe('updateTransaction', () => {
  it('SHOULD forward only the sent fields, converting the date when present', async () => {
    await setup.updateTransaction({ date: '2026-02-28', id: 'id-1', value: 10 });

    expect(mocks.transactionDatasource.update).toHaveBeenCalledWith({
      account_id: undefined,
      category_id: undefined,
      date: new Date('2026-02-28T00:00:00.000Z'),
      description: undefined,
      id: 'id-1',
      owner: undefined,
      owner_id: undefined,
      type: undefined,
      value: 10,
    });
  });

  it('SHOULD keep date undefined WHEN the patch has no date', async () => {
    await setup.updateTransaction({ description: 'x', id: 'id-1' });

    expect(mocks.transactionDatasource.update).toHaveBeenCalledWith(
      expect.objectContaining({ date: undefined, description: 'x' }),
    );
  });
});

describe('card helpers', () => {
  it('SHOULD sum invoices, find purchases and count by card', async () => {
    expect(await setup.sumCardInvoices(['card-1'])).toEqual([
      { amount: 450, creditCardId: 'card-1', invoiceMonth: '2026-10' },
    ]);
    expect(
      await setup.findCardPurchases([{ creditCardId: 'card-1', invoiceMonth: '2026-10' }]),
    ).toHaveLength(1);
    expect(mocks.transactionDatasource.findCardPurchases).toHaveBeenCalledWith([
      { credit_card_id: 'card-1', invoice_month: '2026-10' },
    ]);
    expect(await setup.countByCreditCardId('card-1')).toBe(0);
  });
});

describe('tags (spec 043)', () => {
  it('SHOULD send the names as tag_names on create AND update', async () => {
    await setup.createTransaction({
      accountId: 'a',
      categoryId: 'c',
      currency: 'BRL',
      date: '2026-10-03',
      description: 'x',
      owner: OwnerType.USER,
      ownerId: 'o',
      tags: ['fixo'],
      type: TransactionType.EXPENSE,
      value: 1,
    });
    await setup.updateTransaction({ id: 'id', tags: [] });

    expect(mocks.transactionDatasource.create).toHaveBeenCalledWith(
      expect.objectContaining({ tag_names: ['fixo'] }),
    );
    expect(mocks.transactionDatasource.update).toHaveBeenCalledWith(
      expect.objectContaining({ tag_names: [] }),
    );
  });
});

describe('sumDashboardRows', () => {
  it('SHOULD map the query to the datasource AND the rows back', async () => {
    const rows = await setup.sumDashboardRows({
      byTag: false,
      currency: 'BRL',
      from: '2026-10-01',
      invoiceRefs: [{ creditCardId: 'card-1', invoiceMonth: '2026-10' }],
      owners: [],
      to: '2026-10-31',
    });

    expect(mocks.transactionDatasource.sumDashboardRows).toHaveBeenCalledWith(
      expect.objectContaining({
        by_tag: false,
        invoice_refs: [{ credit_card_id: 'card-1', invoice_month: '2026-10' }],
      }),
    );
    expect(rows).toEqual([
      {
        amount: 900,
        categoryId: 'cat-1',
        count: 2,
        creditCardId: null,
        date: '2026-10-03',
        invoiceMonth: null,
        paid: true,
        tagId: null,
        type: 'EXPENSE',
      },
    ]);
  });
});
