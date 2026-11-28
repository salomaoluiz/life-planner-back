import { Database } from '@shared/infra/db/Database';

import { ActivityDatasource, ITEM_CHUNK } from './index';

const client = {
  activityEntry: {
    create: jest.fn(),
    deleteMany: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
  },
  activityEntryItem: {
    aggregate: jest.fn(),
    count: jest.fn(),
    createMany: jest.fn(),
    findMany: jest.fn(),
    groupBy: jest.fn(),
  },
  financialAccount: { findMany: jest.fn() },
  financialTransaction: { findMany: jest.fn() },
  investmentFixedIncomeTerms: { findMany: jest.fn() },
};
const setup = new ActivityDatasource({ client } as unknown as Database);

beforeEach(() => {
  jest.resetAllMocks();
  client.activityEntry.create.mockResolvedValue({ id: 'entry-1' });
});

function item(n: number) {
  return {
    action: 'CREATE' as const,
    entity_id: `e-${n}`,
    entity_type: 'TRANSACTION' as const,
    entry_id: '',
    label: `l-${n}`,
  };
}

describe('insert', () => {
  it('SHOULD insert the entry then the items in chunks of 500', async () => {
    await setup.insert(
      {} as never,
      Array.from({ length: 1200 }, (_, n) => item(n)),
    );

    expect(client.activityEntry.create).toHaveBeenCalledTimes(1);
    expect(client.activityEntryItem.createMany).toHaveBeenCalledTimes(3);
    expect(client.activityEntryItem.createMany.mock.calls.map(([arg]) => arg.data.length)).toEqual([
      ITEM_CHUNK,
      ITEM_CHUNK,
      200,
    ]);
    expect(client.activityEntryItem.createMany.mock.calls[0][0].data[0].entry_id).toBe('entry-1');
  });

  it('SHOULD NOT touch the items table WHEN there are none', async () => {
    await setup.insert({} as never, []);

    expect(client.activityEntryItem.createMany).not.toHaveBeenCalled();
  });
});

describe('existing', () => {
  it('SHOULD run one query per entity type AND return type:id keys', async () => {
    client.financialTransaction.findMany.mockImplementation(
      async ({ where }: { where: { id: { in: string[] } } }) =>
        where.id.in.includes('t-2') ? [{ id: 't-1' }] : [],
    );
    client.financialAccount.findMany.mockResolvedValue([]);
    client.investmentFixedIncomeTerms.findMany.mockResolvedValue([{ asset_id: 'a-1' }]);

    const found = await setup.existing(
      new Map([
        ['ACCOUNT', ['acc']],
        ['CARD_REFUND', ['t-3']],
        ['FIXED_INCOME_TERMS', ['a-1']],
        ['TRANSACTION_IMPORT', ['x']],
        ['TRANSACTION', ['t-1', 't-1', 't-2']],
      ]),
    );

    // TRANSACTION and CARD_REFUND share a table but are separate map entries.
    expect(client.financialTransaction.findMany).toHaveBeenCalledTimes(2);
    expect(client.financialTransaction.findMany).toHaveBeenCalledWith({
      select: { id: true },
      where: { id: { in: ['t-1', 't-2'] } },
    });
    expect([...found].sort()).toEqual(['FIXED_INCOME_TERMS:a-1', 'TRANSACTION:t-1']);
  });
});

describe('aggregateItems', () => {
  it('SHOULD return count, sources, totals per currency AND the booking range', async () => {
    client.activityEntryItem.groupBy.mockResolvedValue([
      { _sum: { amount_cents: BigInt(-500) }, currency: 'BRL' },
    ]);
    client.activityEntryItem.aggregate.mockResolvedValue({
      _max: { booking_date: new Date('2026-10-31') },
      _min: { booking_date: new Date('2026-10-01') },
    });
    client.activityEntryItem.findMany.mockResolvedValue([{ source_name: 'Conta' }]);
    client.activityEntryItem.count.mockResolvedValue(2);

    await expect(setup.aggregateItems('entry-1')).resolves.toEqual({
      bookingFrom: new Date('2026-10-01'),
      bookingTo: new Date('2026-10-31'),
      count: 2,
      sources: ['Conta'],
      totals: [{ amount: BigInt(-500), currency: 'BRL' }],
    });
  });
});

describe('delete', () => {
  it('SHOULD delete by retention cutoff AND by owner, returning the counts', async () => {
    client.activityEntry.deleteMany.mockResolvedValue({ count: 4 });
    const cutoff = new Date('2026-05-01');

    await expect(setup.deleteOlderThan(cutoff)).resolves.toBe(4);
    expect(client.activityEntry.deleteMany).toHaveBeenCalledWith({
      where: { occurred_at: { lt: cutoff } },
    });
    await expect(setup.deleteByOwner('USER', 'u-1')).resolves.toBe(4);
    expect(client.activityEntry.deleteMany).toHaveBeenLastCalledWith({
      where: { owner: 'USER', owner_id: 'u-1' },
    });
  });
});

describe('findPage / findItems / findEntry', () => {
  it('SHOULD order entries newest first AND items by booking date desc', async () => {
    client.activityEntry.findMany.mockResolvedValue([]);
    client.activityEntryItem.findMany.mockResolvedValue([]);
    client.activityEntry.findFirst.mockResolvedValue(null);

    await setup.findPage({}, 51);
    await setup.findItems({}, 51);
    await setup.findEntry('id', [{ owner: 'USER', owner_id: 'u' }]);

    expect(client.activityEntry.findMany).toHaveBeenCalledWith({
      orderBy: [{ occurred_at: 'desc' }, { id: 'desc' }],
      take: 51,
      where: {},
    });
    expect(client.activityEntryItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 51 }),
    );
    expect(client.activityEntry.findFirst).toHaveBeenCalledWith({
      where: { id: 'id', OR: [{ owner: 'USER', owner_id: 'u' }] },
    });
  });
});
