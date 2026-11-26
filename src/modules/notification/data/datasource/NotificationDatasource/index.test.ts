import { NoticeWrite } from '@notification/data/repository/datasource/INotificationDatasource';
import { Database } from '@shared/infra/db/Database';

import { NotificationDatasource } from './index';

const tx = {
  $executeRaw: jest.fn(),
  notification: { create: jest.fn() },
  notificationDelivery: { update: jest.fn() },
  notificationItem: { createMany: jest.fn(), findMany: jest.fn() },
  notificationPreference: { upsert: jest.fn() },
};
const client = {
  $executeRaw: jest.fn(),
  $queryRaw: jest.fn(),
  $transaction: jest.fn(async (work: unknown) =>
    typeof work === 'function' ? work(tx) : Promise.all(work as never),
  ),
  notification: { deleteMany: jest.fn(), findMany: jest.fn(), updateMany: jest.fn() },
  notificationDelivery: { deleteMany: jest.fn(), findMany: jest.fn(), update: jest.fn() },
  notificationDevice: { deleteMany: jest.fn() },
  notificationFamilyPreference: { deleteMany: jest.fn() },
  notificationItem: { findMany: jest.fn() },
  notificationPreference: { deleteMany: jest.fn() },
};
const setup = new NotificationDatasource({ client } as unknown as Database);
const now = new Date('2026-11-23T11:00:00Z');
const write: NoticeWrite = {
  body: 'b',
  items: [],
  kind: 'SUMMARY',
  local_date: '2026-11-23',
  push_at: now,
  summary_done: true,
  title: 't',
  user_id: 'u',
};

beforeEach(() => {
  jest.clearAllMocks();
  tx.notification.create.mockResolvedValue({ id: 'n-1' });
  tx.notificationItem.findMany.mockResolvedValue([]);
});

describe('create', () => {
  it('SHOULD create the notice, one delivery per enabled device AND set last_summary_on in ONE transaction', async () => {
    const created = await setup.create({
      ...write,
      items: [
        {
          dedupe_key: 'k',
          due_date: now,
          module: 'STOCK',
          owner: 'USER',
          owner_id: 'u',
          position: 0,
          route: '/r',
          snapshot: {},
          source_id: 's',
          state: 'DUE_TODAY',
          type: 'STOCK_EXPIRING',
        },
      ],
    });

    expect(created.id).toBe('n-1');
    expect(client.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        local_date: new Date('2026-11-23T00:00:00.000Z'),
        user_id: 'u',
      }),
    });
    expect(tx.notificationItem.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ dedupe_key: 'k', notification_id: 'n-1', user_id: 'u' })],
    });
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    expect(tx.notificationPreference.upsert).toHaveBeenCalledTimes(1);
  });

  it('SHOULD leave last_summary_on alone for an urgent notice', async () => {
    await setup.create({ ...write, kind: 'URGENT', summary_done: false });

    expect(tx.notificationPreference.upsert).not.toHaveBeenCalled();
  });
});

describe('findPage', () => {
  it('SHOULD page newest first with the cursor, the module and the unread filters', async () => {
    const cursor = { createdAt: now, id: 'c' };

    await setup.findPage({ cursor, limit: 21, module: 'STOCK', unread: true, userId: 'u' });

    expect(client.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
        take: 21,
        where: {
          items: { some: { module: 'STOCK' } },
          OR: [{ created_at: { lt: now } }, { created_at: now, id: { lt: 'c' } }],
          read_at: null,
          user_id: 'u',
        },
      }),
    );
  });

  it('SHOULD only filter by user WHEN no filter is given', async () => {
    await setup.findPage({ limit: 21, userId: 'u' });

    expect(client.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { user_id: 'u' } }),
    );
  });
});

it('SHOULD read the keys of the local date', async () => {
  client.notificationItem.findMany.mockResolvedValue([{ dedupe_key: 'a' }]);

  expect(await setup.findKeys('u', '2026-11-23')).toEqual(['a']);
  expect(client.notificationItem.findMany).toHaveBeenCalledWith({
    select: { dedupe_key: true },
    where: { notification: { local_date: new Date('2026-11-23T00:00:00.000Z') }, user_id: 'u' },
  });
});

it('SHOULD read pending deliveries of enabled devices that are due, AND the sent tickets of a window', async () => {
  await setup.findPendingDeliveries(now, 100);
  await setup.findSentTickets(now, now, 1000);

  expect(client.notificationDelivery.findMany).toHaveBeenNthCalledWith(
    1,
    expect.objectContaining({
      where: { device: { enabled: true }, next_attempt_at: { lte: now }, status: 'PENDING' },
    }),
  );
  expect(client.notificationDelivery.findMany).toHaveBeenNthCalledWith(
    2,
    expect.objectContaining({
      take: 1000,
      where: { sent_at: { gt: now, lt: now }, status: 'SENT', ticket_id: { not: null } },
    }),
  );
});

describe('getUnreadStats', () => {
  it('SHOULD return the row of the single statement', async () => {
    client.$queryRaw.mockResolvedValue([{ count: 2, last_created_at: now, last_read_at: null }]);

    expect(await setup.getUnreadStats('u')).toEqual({
      count: 2,
      last_created_at: now,
      last_read_at: null,
    });
  });

  it('SHOULD answer zeros WHEN there is no row', async () => {
    client.$queryRaw.mockResolvedValue([]);

    expect(await setup.getUnreadStats('u')).toEqual({
      count: 0,
      last_created_at: null,
      last_read_at: null,
    });
  });
});

it('SHOULD mark one notice read keeping the first read time AND report the affected rows', async () => {
  client.$executeRaw.mockResolvedValue(1);

  expect(await setup.markRead('u', 'n', now)).toBe(1);
  expect(client.$executeRaw.mock.calls[0][0].sql).toContain('COALESCE("read_at"');
});

it('SHOULD mark every unread notice up to a moment', async () => {
  await setup.markAllRead('u', now, now);

  expect(client.notification.updateMany).toHaveBeenCalledWith({
    data: { read_at: now },
    where: { created_at: { lte: now }, read_at: null, user_id: 'u' },
  });
});

it('SHOULD delete the family items AND the notices left empty, for one user or for everyone', async () => {
  await setup.removeFamilyItems('u', 'f');
  await setup.removeFamilyItems(undefined, 'f');

  expect(tx.$executeRaw).toHaveBeenCalledTimes(4);
  expect(tx.$executeRaw.mock.calls[0][0].sql).toContain('"owner" = \'FAMILY\'');
});

it('SHOULD delete final deliveries and old notices', async () => {
  client.notificationDelivery.deleteMany.mockResolvedValue({ count: 4 });
  client.notification.deleteMany.mockResolvedValue({ count: 5 });

  expect(await setup.cleanup(now, now)).toEqual({ deliveries: 4, notices: 5 });
  expect(client.notificationDelivery.deleteMany).toHaveBeenCalledWith({
    where: { created_at: { lt: now }, status: { in: ['SENT', 'FAILED', 'INVALID'] } },
  });
});

it('SHOULD update deliveries in one transaction AND do nothing for an empty list', async () => {
  await setup.updateDeliveries([]);
  await setup.updateDeliveries([{ id: 'del', status: 'SENT', ticket_id: 't' }]);

  expect(client.$transaction).toHaveBeenCalledTimes(1);
  expect(tx.notificationDelivery.update).toHaveBeenCalledWith({
    data: { status: 'SENT', ticket_id: 't' },
    where: { id: 'del' },
  });
});

it('SHOULD delete everything of a user in one transaction AND return the notices deleted', async () => {
  client.notification.deleteMany.mockResolvedValue({ count: 7 });

  expect(await setup.deleteByUser('u')).toBe(7);
  expect(client.$transaction).toHaveBeenCalledTimes(1);
  expect(client.notificationDevice.deleteMany).toHaveBeenCalledWith({ where: { user_id: 'u' } });
  expect(client.notificationPreference.deleteMany).toHaveBeenCalledWith({
    where: { user_id: 'u' },
  });
});
