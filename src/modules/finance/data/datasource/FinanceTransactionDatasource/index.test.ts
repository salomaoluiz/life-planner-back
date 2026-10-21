import { NotFoundException } from '@nestjs/common';

import { SYSTEM_CATEGORY_IDS } from '@finance/domain/entity/SystemCategory';
import { SystemCategoryKey, TransactionSource } from '@finance/domain/enum';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { mocks, setup, spies } from './index.mocks';

describe('Method countByAccountId / countByCategoryIds', () => {
  it('SHOULD count the transactions of an account', async () => {
    spies.count.mockResolvedValue(3);

    expect(await setup.countByAccountId('acc-1')).toBe(3);
    expect(spies.count).toHaveBeenCalledWith({ where: { account_id: 'acc-1' } });
  });

  it('SHOULD count the transactions, the installment plans AND the recurrences of ANY of the given categories', async () => {
    spies.count.mockResolvedValue(1);
    spies.planCount.mockResolvedValue(2);
    spies.recurrenceCount.mockResolvedValue(4);

    expect(await setup.countByCategoryIds(['c1', 'c2'])).toBe(7);
    expect(spies.recurrenceCount).toHaveBeenCalledWith({
      where: { category_id: { in: ['c1', 'c2'] } },
    });
    expect(spies.count).toHaveBeenCalledWith({ where: { category_id: { in: ['c1', 'c2'] } } });
    expect(spies.planCount).toHaveBeenCalledWith({ where: { category_id: { in: ['c1', 'c2'] } } });
  });
});

describe('Method create', () => {
  const params = {
    account_id: mocks.transaction.account_id,
    category_id: mocks.transaction.category_id,
    currency: 'BRL' as const,
    date: new Date('2026-10-03T00:00:00.000Z'),
    description: 'Weekly groceries',
    owner: 'USER' as const,
    owner_id: mocks.transaction.owner_id,
    type: 'EXPENSE' as const,
    value: 23490,
  };

  it('SHOULD insert the row AND move the ledger of its account in the SAME database transaction', async () => {
    spies.create.mockResolvedValue(mocks.transaction);

    expect(await setup.create(params)).toEqual(mocks.transaction);
    expect(spies.transaction).toHaveBeenCalledTimes(1);
    expect(spies.create).toHaveBeenCalledWith({ data: params, include: mocks.include });
    expect(spies.accountUpdate).toHaveBeenCalledWith({
      data: { ledger_balance: { increment: -23490 } },
      where: { id: mocks.transaction.account_id },
    });
  });

  it('SHOULD NOT move the ledger WHEN the new row is unpaid', async () => {
    spies.create.mockResolvedValue({ ...mocks.transaction, paid: false });

    await setup.create({ ...params, paid: false });

    expect(spies.accountUpdate).not.toHaveBeenCalled();
  });

  it('SHOULD add an INCOME to the ledger', async () => {
    spies.create.mockResolvedValue({ ...mocks.transaction, type: 'INCOME', value: 500 });

    await setup.create({ ...params, type: 'INCOME', value: 500 });

    expect(spies.accountUpdate).toHaveBeenCalledWith({
      data: { ledger_balance: { increment: 500 } },
      where: { id: mocks.transaction.account_id },
    });
  });

  it('SHOULD propagate a failure of the ledger update so the whole transaction rolls back', async () => {
    spies.create.mockResolvedValue(mocks.transaction);
    spies.accountUpdate.mockRejectedValueOnce(new Error('ledger down'));

    await expect(setup.create(params)).rejects.toThrow('ledger down');
  });
});

describe('Method delete', () => {
  it('SHOULD lock the row, delete it AND reverse its signed value on the ledger', async () => {
    spies.queryRaw.mockResolvedValue([
      { account_id: 'acc-1', paid: true, type: 'EXPENSE', value: 1000 },
    ]);
    spies.deleteMany.mockResolvedValue({ count: 1 });

    await expect(setup.delete(mocks.transaction.id)).resolves.toBeUndefined();

    expect(spies.queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      spies.deleteMany.mock.invocationCallOrder[0],
    );
    expect(spies.deleteMany).toHaveBeenCalledWith({ where: { id: mocks.transaction.id } });
    expect(spies.accountUpdate).toHaveBeenCalledWith({
      data: { ledger_balance: { increment: 1000 } },
      where: { id: 'acc-1' },
    });
  });

  it('SHOULD do nothing (idempotent) WHEN the row is already gone', async () => {
    spies.queryRaw.mockResolvedValue([]);

    await expect(setup.delete(mocks.transaction.id)).resolves.toBeUndefined();

    expect(spies.deleteMany).not.toHaveBeenCalled();
    expect(spies.accountUpdate).not.toHaveBeenCalled();
  });
});

describe('Method exists', () => {
  it('SHOULD return true / false from a cheap findFirst on (owner, owner_id)', async () => {
    spies.findFirst.mockResolvedValueOnce({ id: 'x' }).mockResolvedValueOnce(null);
    const params = { owner: 'FAMILY' as const, owner_id: 'family-id' };

    expect(await setup.exists(params)).toBe(true);
    expect(await setup.exists(params)).toBe(false);
    expect(spies.findFirst).toHaveBeenCalledWith({
      select: { id: true },
      where: { owner: 'FAMILY', owner_id: 'family-id' },
    });
  });
});

describe('Method findById', () => {
  it('SHOULD return the row with relations, or null WHEN not found', async () => {
    spies.findUnique.mockResolvedValueOnce(mocks.transaction).mockResolvedValueOnce(null);

    expect(await setup.findById(mocks.transaction.id)).toEqual(mocks.transaction);
    expect(await setup.findById('missing')).toBeNull();
    expect(spies.findUnique).toHaveBeenCalledWith({
      include: mocks.include,
      where: { id: mocks.transaction.id },
    });
  });
});

describe('Method findByOwners', () => {
  it('SHOULD query every owner in ONE findMany, joined, sorted by date desc then created_at desc', async () => {
    spies.findMany.mockResolvedValue([mocks.transaction]);

    const result = await setup.findByOwners(mocks.owners);

    expect(result).toEqual([mocks.transaction]);
    expect(spies.findMany).toHaveBeenCalledTimes(1);
    expect(spies.findMany).toHaveBeenCalledWith({
      include: mocks.include,
      orderBy: [{ date: 'desc' }, { created_at: 'desc' }],
      where: {
        AND: [
          { OR: [{ owner: 'USER', owner_id: mocks.owners[0].ownerId }] },
          {
            credit_card_id: null,
            OR: [
              { category: { system_key: null } },
              { category: { system_key: { not: 'INVOICE_PAYMENT' } } },
              { early_payment: { isNot: null } },
            ],
          },
        ],
      },
    });
  });

  it('SHOULD query card purchases WHEN the source is CARD', async () => {
    spies.findMany.mockResolvedValue([]);

    await setup.findByOwners(mocks.owners, TransactionSource.CARD, { invoiceMonth: '2026-10' });

    expect(spies.findMany.mock.calls[0][0].where.AND[1]).toEqual({
      credit_card_id: { not: null },
      invoice_month: '2026-10',
    });
  });
});

describe('Method findByOwners filters (spec 045)', () => {
  it('SHOULD add one AND condition per filter on account rows', async () => {
    spies.findMany.mockResolvedValue([]);

    await setup.findByOwners(mocks.owners, TransactionSource.ACCOUNT, {
      accountIds: ['acc-1'],
      categoryIds: ['cat-1'],
      from: '2025-01-01',
      paid: false,
      tagIds: ['tag-1'],
      to: '2025-12-31',
    });

    expect(spies.findMany.mock.calls[0][0].where.AND.slice(2)).toEqual([
      { category_id: { in: ['cat-1'] } },
      { tags: { some: { tag_id: { in: ['tag-1'] } } } },
      { account_id: { in: ['acc-1'] } },
      { paid: false },
      {
        date: {
          gte: new Date('2025-01-01T00:00:00.000Z'),
          lte: new Date('2025-12-31T00:00:00.000Z'),
        },
      },
    ]);
  });

  it('SHOULD bound CARD rows by invoice refs and chosen cards', async () => {
    spies.findMany.mockResolvedValue([]);

    await setup.findByOwners(mocks.owners, TransactionSource.CARD, {
      creditCardIds: ['card-1'],
      invoiceRefs: [{ credit_card_id: 'card-1', invoice_month: '2026-10' }],
    });

    const { AND } = spies.findMany.mock.calls[0][0].where;

    expect(AND[1].credit_card_id).toEqual({ in: ['card-1'] });
    expect(AND[2]).toEqual({ OR: [{ credit_card_id: 'card-1', invoice_month: '2026-10' }] });
  });
});

describe('Method update', () => {
  const lockedRow = [{ account_id: 'acc-1', paid: true, type: 'EXPENSE', value: 1000 }];

  it('SHOULD update only the sent columns AND return the row with relations', async () => {
    spies.queryRaw.mockResolvedValue(lockedRow);
    spies.update.mockResolvedValue({ ...mocks.transaction, account_id: 'acc-1', value: 100 });

    const result = await setup.update({ description: 'New', id: mocks.transaction.id, value: 100 });

    expect(result).toEqual({ ...mocks.transaction, account_id: 'acc-1', value: 100 });
    expect(spies.update).toHaveBeenCalledWith({
      data: {
        account_id: undefined,
        category_id: undefined,
        date: undefined,
        description: 'New',
        owner: undefined,
        owner_id: undefined,
        type: undefined,
        value: 100,
      },
      include: mocks.include,
      where: { id: mocks.transaction.id },
    });
  });

  it('SHOULD lock the stored row BEFORE updating AND compute the delta from the LOCKED row (not from an earlier read)', async () => {
    spies.queryRaw.mockResolvedValue(lockedRow); // another request already changed it to 1000
    spies.update.mockResolvedValue({
      ...mocks.transaction,
      account_id: 'acc-1',
      type: 'EXPENSE',
      value: 1500,
    });

    await setup.update({ id: mocks.transaction.id, value: 1500 });

    expect(spies.queryRaw.mock.calls[0][0].sql).toContain('FOR UPDATE');
    expect(spies.queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      spies.update.mock.invocationCallOrder[0],
    );
    expect(spies.accountUpdate).toHaveBeenCalledTimes(1);
    expect(spies.accountUpdate).toHaveBeenCalledWith({
      data: { ledger_balance: { increment: -500 } },
      where: { id: 'acc-1' },
    });
  });

  it('SHOULD reverse the old account AND apply the new one WHEN the account changes (ascending id order)', async () => {
    spies.queryRaw.mockResolvedValue([
      { account_id: 'acc-b', paid: true, type: 'EXPENSE', value: 200 },
    ]);
    spies.update.mockResolvedValue({
      ...mocks.transaction,
      account_id: 'acc-a',
      type: 'EXPENSE',
      value: 200,
    });

    await setup.update({ account_id: 'acc-a', id: mocks.transaction.id });

    expect(spies.accountUpdate).toHaveBeenNthCalledWith(1, {
      data: { ledger_balance: { increment: -200 } },
      where: { id: 'acc-a' },
    });
    expect(spies.accountUpdate).toHaveBeenNthCalledWith(2, {
      data: { ledger_balance: { increment: 200 } },
      where: { id: 'acc-b' },
    });
  });

  it('SHOULD not touch any account WHEN the effect on the ledger is unchanged (description only)', async () => {
    spies.queryRaw.mockResolvedValue(lockedRow);
    spies.update.mockResolvedValue({
      ...mocks.transaction,
      account_id: 'acc-1',
      type: 'EXPENSE',
      value: 1000,
    });

    await setup.update({ description: 'Renamed', id: mocks.transaction.id });

    expect(spies.accountUpdate).not.toHaveBeenCalled();
  });

  it('SHOULD throw NotFound AND write nothing WHEN the row vanished before the lock', async () => {
    spies.queryRaw.mockResolvedValue([]);

    await expect(setup.update({ id: mocks.transaction.id, value: 1 })).rejects.toThrow(
      NotFoundException,
    );
    expect(spies.update).not.toHaveBeenCalled();
    expect(spies.accountUpdate).not.toHaveBeenCalled();
  });
});

describe('Card purchases', () => {
  const cardParams = {
    account_id: null,
    category_id: mocks.transaction.category_id,
    credit_card_id: 'card-1',
    currency: 'BRL' as const,
    date: new Date('2026-10-03T00:00:00.000Z'),
    description: 'Market',
    invoice_month: '2026-10',
    owner: 'USER' as const,
    owner_id: mocks.transaction.owner_id,
    type: 'EXPENSE' as const,
    value: 1000,
  };

  it('SHOULD lock the card, create the row and NOT touch any account ledger', async () => {
    spies.paymentFindFirst.mockResolvedValue(null);
    spies.create.mockResolvedValue({ ...mocks.transaction, account_id: null });

    await setup.create(cardParams);

    expect(spies.queryRaw).toHaveBeenCalledTimes(1);
    expect(spies.accountUpdate).not.toHaveBeenCalled();
  });

  it('SHOULD reject with 422 WHEN the invoice already has a payment', async () => {
    spies.paymentFindFirst.mockResolvedValue({ id: 'payment-1' });

    await expect(setup.create(cardParams)).rejects.toThrow('Invoice is paid');
    expect(spies.create).not.toHaveBeenCalled();
  });

  it('SHOULD refuse to delete a purchase of a paid invoice', async () => {
    spies.findUnique.mockResolvedValue({ credit_card_id: 'card-1' });
    spies.queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([
      {
        account_id: null,
        credit_card_id: 'card-1',
        invoice_month: '2026-10',
        type: 'EXPENSE',
        value: 1000,
      },
    ]);
    spies.paymentFindFirst.mockResolvedValue({ id: 'payment-1' });

    await expect(setup.delete('tx-1')).rejects.toThrow('Invoice is paid');
    expect(spies.deleteMany).not.toHaveBeenCalled();
  });

  it('SHOULD sum the NET of each invoice (purchases minus credits) AND the early payments apart', async () => {
    spies.groupBy.mockResolvedValue([
      {
        _sum: { value: 1000 },
        category_id: 'c1',
        credit_card_id: 'card-1',
        invoice_month: '2026-10',
        type: 'EXPENSE',
      },
      {
        _sum: { value: 600 },
        category_id: SYSTEM_CATEGORY_IDS[SystemCategoryKey.CARD_EARLY_PAYMENT],
        credit_card_id: 'card-1',
        invoice_month: '2026-10',
        type: 'INCOME',
      },
      {
        _sum: { value: 100 },
        category_id: SYSTEM_CATEGORY_IDS[SystemCategoryKey.CARD_REFUND],
        credit_card_id: 'card-1',
        invoice_month: '2026-10',
        type: 'INCOME',
      },
    ]);

    expect(await setup.sumCardInvoices(['card-1'])).toEqual([
      { amount: 300, credit_card_id: 'card-1', early_paid: 600, invoice_month: '2026-10' },
    ]);
    expect(await setup.sumCardInvoices([])).toEqual([]);
    expect(spies.groupBy).toHaveBeenCalledTimes(1);
  });

  it('SHOULD return no purchases without keys AND count by card', async () => {
    expect(await setup.findCardPurchases([])).toEqual([]);
    spies.count.mockResolvedValue(2);
    expect(await setup.countByCreditCardId('card-1')).toBe(2);
  });
});

describe('Method update on a paid invoice (spec 030 FR 16)', () => {
  const lockedRow = [
    {
      account_id: null,
      credit_card_id: 'card-1',
      invoice_month: '2026-10',
      type: 'EXPENSE',
      value: 1000,
    },
  ];

  it('SHOULD allow description and category WITHOUT looking at the payments', async () => {
    spies.queryRaw.mockResolvedValue(lockedRow);
    spies.paymentFindFirst.mockResolvedValue({ id: 'payment-1' });
    spies.update.mockResolvedValue(mocks.transaction);

    await setup.update({ category_id: 'cat-2', description: 'New', id: mocks.transaction.id });

    expect(spies.paymentFindFirst).not.toHaveBeenCalled();
    expect(spies.update).toHaveBeenCalledTimes(1);
  });

  it('SHOULD refuse a value change (422)', async () => {
    spies.queryRaw.mockResolvedValue(lockedRow);
    spies.paymentFindFirst.mockResolvedValue({ id: 'payment-1' });

    await expect(setup.update({ id: mocks.transaction.id, value: 5 })).rejects.toThrow(
      'Invoice is paid',
    );
    expect(spies.update).not.toHaveBeenCalled();
  });
});

describe('tags (spec 043)', () => {
  const createParams = {
    account_id: mocks.transaction.account_id,
    category_id: mocks.transaction.category_id,
    currency: 'BRL' as const,
    date: new Date('2026-10-03T00:00:00.000Z'),
    description: 'Weekly groceries',
    owner: 'USER' as const,
    owner_id: mocks.transaction.owner_id,
    type: 'EXPENSE' as const,
    value: 23490,
  };
  const withTags = { ...mocks.transaction, tags: [{ tag: { id: 'tag-1', name: 'fixo' } }] };

  it('SHOULD resolve the names in the owner, link them AND return the row with its tags on create', async () => {
    spies.create.mockResolvedValue(mocks.transaction);
    spies.findMany.mockResolvedValue([mocks.transaction.id].map((id) => ({ id })));
    spies.tagFindMany.mockResolvedValue([{ all_scopes: false, id: 'tag-1', name: 'Fixo' }]);
    spies.tagCreate.mockResolvedValue({ id: 'tag-2' });
    spies.findUniqueOrThrow.mockResolvedValue(withTags);

    const result = await setup.create({ ...createParams, tag_names: ['fixo', 'novo'] });

    expect(spies.create).toHaveBeenCalledWith({ data: createParams, include: mocks.include });
    expect(spies.tagLinkCreateMany).toHaveBeenCalledWith({
      data: [
        { position: 0, tag_id: 'tag-1', transaction_id: mocks.transaction.id },
        { position: 1, tag_id: 'tag-2', transaction_id: mocks.transaction.id },
      ],
    });
    expect(result).toBe(withTags);
  });

  it('SHOULD skip the tag work WHEN no names are sent on create', async () => {
    spies.create.mockResolvedValue(mocks.transaction);

    expect(await setup.create({ ...createParams, tag_names: [] })).toBe(mocks.transaction);
    expect(spies.tagLinkCreateMany).not.toHaveBeenCalled();
  });

  describe('update', () => {
    const lockedRow = [{ account_id: 'acc-1', paid: true, type: 'EXPENSE', value: 1000 }];

    beforeEach(() => {
      spies.queryRaw.mockResolvedValue(lockedRow);
      spies.update.mockResolvedValue({ ...mocks.transaction, account_id: 'acc-1' });
      spies.findMany.mockResolvedValue([{ id: mocks.transaction.id }]);
      spies.findUniqueOrThrow.mockResolvedValue(withTags);
    });

    it('SHOULD replace the tags WHEN names are sent (and remove all for [])', async () => {
      spies.tagFindMany.mockResolvedValue([{ all_scopes: false, id: 'tag-1', name: 'fixo' }]);

      expect(await setup.update({ id: mocks.transaction.id, tag_names: ['fixo'] })).toBe(withTags);
      expect(spies.tagLinkCreateMany).toHaveBeenCalledWith({
        data: [{ position: 0, tag_id: 'tag-1', transaction_id: mocks.transaction.id }],
      });

      await setup.update({ id: mocks.transaction.id, tag_names: [] });

      expect(spies.tagLinkDeleteMany).toHaveBeenLastCalledWith({
        where: { transaction_id: { in: [mocks.transaction.id] } },
      });
    });

    it('SHOULD leave the tags alone WHEN no names are sent and the owner is the same', async () => {
      const result = await setup.update({ id: mocks.transaction.id, value: 5 });

      expect(result).toEqual({ ...mocks.transaction, account_id: 'acc-1' });
      expect(spies.tagLinkCreateMany).not.toHaveBeenCalled();
    });

    it('SHOULD re-resolve the current tag names in the NEW owner WHEN the owner changes', async () => {
      spies.findUnique.mockResolvedValue({ owner: 'USER', owner_id: 'owner-a' });
      spies.update.mockResolvedValue({
        ...mocks.transaction,
        account_id: 'acc-1',
        owner: 'FAMILY',
        owner_id: 'family-1',
      });
      spies.tagLinkFindMany.mockResolvedValue([{ tag: { name: 'viagem' } }]);
      spies.tagCreate.mockResolvedValue({ id: 'tag-family' });

      await setup.update({ id: mocks.transaction.id, owner: 'FAMILY', owner_id: 'family-1' });

      expect(spies.tagCreate).toHaveBeenCalledWith({
        data: { creator_id: 'family-1', name: 'viagem', owner: 'FAMILY', owner_id: 'family-1' },
        select: { id: true },
      });
      expect(spies.tagLinkCreateMany).toHaveBeenCalledWith({
        data: [{ position: 0, tag_id: 'tag-family', transaction_id: mocks.transaction.id }],
      });
    });
  });
});

describe('Method sumDashboardRows (spec 046)', () => {
  const params = {
    by_tag: false,
    currency: 'BRL' as const,
    from: '2026-10-01',
    invoice_month_from: '2026-09',
    invoice_month_to: '2026-11',
    owners: [{ owner: OwnerType.USER, ownerId: 'user-1' }],
    to: '2026-10-31',
  };
  function sqlOf(call: number): string {
    return spies.queryRaw.mock.calls[call][0].sql as string;
  }

  it('SHOULD return nothing without owners AND not query', async () => {
    expect(await setup.sumDashboardRows({ ...params, owners: [] })).toEqual([]);
    expect(spies.queryRaw).not.toHaveBeenCalled();
  });

  it('SHOULD group in SQL, leave the money-moving system categories out AND convert the sums', async () => {
    spies.queryRaw.mockResolvedValue([
      {
        amount: BigInt(1500),
        category_id: 'cat-1',
        count: BigInt(2),
        credit_card_id: null,
        date: '2026-10-03',
        invoice_month: null,
        paid: true,
        tag_id: null,
        type: 'EXPENSE',
      },
    ]);

    const rows = await setup.sumDashboardRows(params);

    expect(rows).toEqual([expect.objectContaining({ amount: 1500, count: 2 })]);
    expect(sqlOf(0)).toContain('GROUP BY');
    expect(sqlOf(0)).toContain('"system_key"::text NOT IN');
    expect(sqlOf(0)).toContain('"currency" =');
    expect(sqlOf(0)).not.toContain('financial_transaction_tags');
  });

  it('SHOULD join the tags only by tag AND apply the filters', async () => {
    spies.queryRaw.mockResolvedValue([]);

    await setup.sumDashboardRows({
      ...params,
      account_ids: ['acc-1'],
      by_tag: true,
      category_ids: ['cat-1'],
      credit_card_ids: ['card-1'],
      q: '100%',
      tag_ids: ['tag-1'],
    });

    const sql = sqlOf(0);

    expect(sql).toContain('LEFT JOIN "financial_transaction_tags"');
    expect(sql).toContain('"account_id" IN');
    expect(sql).toContain('"credit_card_id" IN');
    expect(sql).toContain('"category_id" IN');
    expect(sql).toContain('EXISTS');
    expect(sql).toContain('ILIKE');
  });

  it('SHOULD read only card rows for the CARD source AND only account rows for ACCOUNT', async () => {
    spies.queryRaw.mockResolvedValue([]);

    await setup.sumDashboardRows({ ...params, source: 'CARD' as never });
    await setup.sumDashboardRows({ ...params, source: 'ACCOUNT' as never });

    expect(sqlOf(0)).not.toContain('"credit_card_id" IS NULL AND');
    expect(sqlOf(1)).not.toContain('"credit_card_id" IS NOT NULL');
  });
});
