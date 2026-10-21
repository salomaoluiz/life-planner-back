import { TransactionType } from '@finance/domain/enum';

import { mocks, setup } from './index.mocks';

describe('GetFinanceTotalsUseCase PERIOD', () => {
  it('SHOULD return one item per month with income and expenses split by realized and projected', async () => {
    mocks.rows.execute.mockResolvedValue([
      mocks.rowOf({ amount: 500, bucketDate: '2026-09-02' }),
      mocks.rowOf({ amount: 200, bucketDate: '2026-10-25', projected: true }),
      mocks.rowOf({ amount: 900, bucketDate: '2026-10-02', type: TransactionType.INCOME }),
    ]);

    const result = await setup.execute({ ...mocks.input, groupBy: 'PERIOD' });

    expect(result).toMatchObject({ bucket: 'MONTH', groupBy: 'PERIOD' });
    if (result.groupBy !== 'PERIOD') {
      throw new Error('unexpected');
    }
    expect(result.items).toHaveLength(12);
    expect(result.items[10].expense.realized).toBe(500);
    expect(result.items[11].expense.projected).toBe(200);
    expect(result.items[11].income.realized).toBe(900);
  });

  it('SHOULD group by week up to 92 days', async () => {
    const result = await setup.execute({
      ...mocks.input,
      from: '2026-08-01',
      groupBy: 'PERIOD',
    });

    expect(result).toMatchObject({ bucket: 'WEEK' });
  });
});

describe('GetFinanceTotalsUseCase CATEGORY', () => {
  it('SHOULD fold subcategories into their root AND order by amount', async () => {
    mocks.rows.execute.mockResolvedValue([
      mocks.rowOf({ amount: 300, categoryId: 'food' }),
      mocks.rowOf({ amount: 800, categoryId: 'rent' }),
      mocks.rowOf({ amount: 100, categoryId: 'housing' }),
      mocks.rowOf({ amount: 999, categoryId: 'food', type: TransactionType.INCOME }),
    ]);

    const result = await setup.execute({
      ...mocks.input,
      groupBy: 'CATEGORY',
      type: TransactionType.EXPENSE,
    });

    expect(result).toEqual({
      groupBy: 'CATEGORY',
      items: [
        expect.objectContaining({ categoryId: 'housing', hasChildren: true, realized: 900 }),
        expect.objectContaining({ categoryId: 'food', hasChildren: false, realized: 300 }),
      ],
      total: 1200,
    });
  });

  it('SHOULD list the children of a parent plus a self item AND flag archived ones', async () => {
    mocks.rows.execute.mockResolvedValue([
      mocks.rowOf({ amount: 800, categoryId: 'rent' }),
      mocks.rowOf({ amount: 100, categoryId: 'housing' }),
      mocks.rowOf({ amount: 300, categoryId: 'food' }),
    ]);

    const result = await setup.execute({
      ...mocks.input,
      groupBy: 'CATEGORY',
      parentId: 'housing',
      type: TransactionType.EXPENSE,
    });

    expect(result).toMatchObject({
      items: [
        { archived: true, categoryId: 'rent', realized: 800, self: false },
        { categoryId: 'housing', realized: 100, self: true },
      ],
      total: 900,
    });
  });

  it('SHOULD require the type', async () => {
    await expect(setup.execute({ ...mocks.input, groupBy: 'CATEGORY' })).rejects.toThrow();
  });
});

describe('GetFinanceTotalsUseCase TAG', () => {
  it('SHOULD count a row with two tags in each tag AND once in the total', async () => {
    mocks.rows.execute.mockImplementation(async ({ byTag }: { byTag: boolean }) =>
      Promise.resolve(
        byTag
          ? [
              mocks.rowOf({ amount: 500, tagId: 'tag-fixed' }),
              mocks.rowOf({ amount: 500, tagId: 'tag-other' }),
              mocks.rowOf({ amount: 200, count: 2, tagId: null }),
            ]
          : [mocks.rowOf({ amount: 500 }), mocks.rowOf({ amount: 200, count: 2 })],
      ),
    );

    const result = await setup.execute({
      ...mocks.input,
      groupBy: 'TAG',
      type: TransactionType.EXPENSE,
    });

    expect(result).toMatchObject({
      groupBy: 'TAG',
      items: [
        { name: 'fixed', realized: 500, tagId: 'tag-fixed' },
        { name: '', realized: 500, tagId: 'tag-other' },
      ],
      total: 700,
      untagged: { count: 2, realized: 200 },
    });
  });
});
