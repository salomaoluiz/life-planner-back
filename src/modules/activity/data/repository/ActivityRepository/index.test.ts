import { ActivityActionFilter, ActivityModule } from '@activity/domain/enum';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { ActivityRepository } from './index';

const datasource = {
  aggregateItems: jest.fn(),
  deleteByOwner: jest.fn(),
  deleteOlderThan: jest.fn(),
  existing: jest.fn(),
  findEntry: jest.fn(),
  findItems: jest.fn(),
  findPage: jest.fn(),
  insert: jest.fn(),
};
const setup = new ActivityRepository(datasource as never);
const owners = [{ ownerId: 'u-1', ownerType: OwnerType.USER }];
const base = {
  from: new Date('2026-11-01'),
  module: ActivityModule.FINANCE,
  owners,
  to: new Date('2026-11-30'),
};
function row(n: number, extra: object = {}) {
  return {
    action: 'CREATE',
    actor_id: 'a',
    actor_name: 'Ana',
    batch: false,
    changes: null,
    entity_id: `e-${n}`,
    entity_type: 'TRANSACTION',
    id: `id-${n}`,
    modules: ['FINANCE'],
    occurred_at: new Date('2026-11-24T10:00:00Z'),
    owner: 'USER',
    owner_id: 'u-1',
    search_text: 'x',
    summary: { label: 'Mercado', ownerName: 'Ana' },
    ...extra,
  };
}

beforeEach(() => jest.resetAllMocks());

describe('list', () => {
  it('SHOULD filter by module, owners and window AND return a page with hasMore', async () => {
    datasource.findPage.mockResolvedValue([row(1), row(2), row(3)]);

    const page = await setup.list(base, 2);

    expect(page.hasMore).toBe(true);
    expect(page.rows.map((entry) => entry.id)).toEqual(['id-1', 'id-2']);
    expect(datasource.findPage).toHaveBeenCalledWith(
      expect.objectContaining({
        modules: { has: 'FINANCE' },
        occurred_at: { gte: base.from, lte: base.to },
      }),
      3,
    );
  });

  it('SHOULD map BATCH to batch=true AND the other actions to action', async () => {
    datasource.findPage.mockResolvedValue([]);

    await setup.list({ ...base, action: ActivityActionFilter.BATCH }, 50);
    await setup.list({ ...base, action: ActivityActionFilter.DELETE, actorId: 'a-1' }, 50);

    expect(datasource.findPage.mock.calls[0][0]).toMatchObject({ batch: true });
    expect(datasource.findPage.mock.calls[0][0]).not.toHaveProperty('action');
    expect(datasource.findPage.mock.calls[1][0]).toMatchObject({
      action: 'DELETE',
      actor_id: 'a-1',
    });
  });

  it('SHOULD add the keyset condition WHEN there is a cursor', async () => {
    datasource.findPage.mockResolvedValue([]);
    const occurredAt = new Date('2026-11-20T00:00:00Z');

    await setup.list({ ...base, cursor: { id: 'c', occurredAt } }, 50);

    expect(datasource.findPage.mock.calls[0][0].AND).toContainEqual({
      OR: [{ occurred_at: { lt: occurredAt } }, { id: { lt: 'c' }, occurred_at: occurredAt }],
    });
  });

  it('SHOULD search the normalized text AND the amount variant for "1.200,00"', async () => {
    datasource.findPage.mockResolvedValue([]);

    await setup.list({ ...base, q: '1.200,00' }, 50);
    await setup.list({ ...base, q: ' Mercadão ' }, 50);

    expect(datasource.findPage.mock.calls[0][0].AND).toContainEqual({
      OR: [{ search_text: { contains: '1.200,00' } }, { search_text: { contains: '1200,00' } }],
    });
    expect(datasource.findPage.mock.calls[1][0].AND).toContainEqual({
      OR: [{ search_text: { contains: 'mercadao' } }],
    });
  });

  it('SHOULD expose the batch preview kept in the summary', async () => {
    datasource.findPage.mockResolvedValue([
      row(1, {
        batch: true,
        summary: {
          extra: { itemCount: 128, previewLabels: ['Padaria'] },
          label: 'x',
          ownerName: 'o',
        },
      }),
    ]);

    const page = await setup.list(base, 50);

    expect(page.rows[0].batchPreview).toEqual({ count: 128, labels: ['Padaria'] });
  });
});

describe('findEntry', () => {
  it('SHOULD return null without querying WHEN the user reads no owner', async () => {
    await expect(setup.findEntry('id', [])).resolves.toBeNull();
    expect(datasource.findEntry).not.toHaveBeenCalled();
  });
});

describe('insert', () => {
  it('SHOULD map the entry AND its items (cents to bigint, ISO date to Date)', async () => {
    await setup.insert({
      action: 'CREATE' as never,
      actorId: 'a',
      actorName: 'Ana',
      batch: true,
      changes: null,
      entityId: null,
      entityType: 'TRANSACTION_IMPORT' as never,
      items: [
        {
          action: 'CREATE' as never,
          amountCents: -2350,
          bookingDate: '2026-10-31',
          entityId: 'e',
          entityType: 'TRANSACTION' as never,
          label: 'Padaria',
        },
      ],
      modules: [ActivityModule.FINANCE],
      occurredAt: new Date('2026-11-24'),
      ownerId: 'u-1',
      ownerType: OwnerType.USER,
      searchText: 'padaria',
      summary: { label: 'Import', ownerName: 'Ana' },
    });

    const [entry, items] = datasource.insert.mock.calls[0];

    expect(entry).toMatchObject({ batch: true, entity_id: null, owner: 'USER', owner_id: 'u-1' });
    expect(items[0]).toMatchObject({
      amount_cents: BigInt(-2350),
      booking_date: new Date('2026-10-31T00:00:00.000Z'),
      currency: null,
    });
  });
});

describe('listItems', () => {
  it('SHOULD return the header only WHEN asked AND the page with hasMore', async () => {
    datasource.findItems.mockResolvedValue([
      {
        amount_cents: BigInt(-100),
        booking_date: new Date('2026-10-31'),
        entity_type: 'TRANSACTION',
        id: 'i1',
      },
      { amount_cents: null, booking_date: null, entity_type: 'TRANSACTION', id: 'i2' },
    ]);
    datasource.aggregateItems.mockResolvedValue({
      bookingFrom: new Date('2026-10-01'),
      bookingTo: new Date('2026-10-31'),
      count: 2,
      sources: ['Conta'],
      totals: [{ amount: BigInt(-100), currency: 'BRL' }],
    });

    const first = await setup.listItems({ entryId: 'e' }, 1, true);
    const next = await setup.listItems({ entryId: 'e' }, 1, false);

    expect(first.hasMore).toBe(true);
    expect(first.items).toHaveLength(1);
    expect(first.items[0]).toMatchObject({ amountCents: -100, bookingDate: '2026-10-31' });
    expect(first.header).toEqual({
      bookingFrom: '2026-10-01',
      bookingTo: '2026-10-31',
      count: 2,
      sources: ['Conta'],
      totals: [{ amountCents: -100, currency: 'BRL' }],
    });
    expect(next.header).toBeNull();
    expect(datasource.aggregateItems).toHaveBeenCalledTimes(1);
  });

  it('SHOULD search label, source AND the amount in both signs', async () => {
    datasource.findItems.mockResolvedValue([]);

    await setup.listItems({ entryId: 'e', q: '23,50' }, 50, false);

    expect(datasource.findItems.mock.calls[0][0].AND[0].OR).toContainEqual({
      amount_cents: { in: [BigInt(2350), BigInt(-2350)] },
    });
  });
});
