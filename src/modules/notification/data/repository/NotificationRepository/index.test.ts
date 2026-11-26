import { NotificationRepository } from './index';

const datasource = {
  cleanup: jest.fn(),
  create: jest.fn(),
  deleteByUser: jest.fn(),
  findKeys: jest.fn(),
  findPage: jest.fn(),
  findPendingDeliveries: jest.fn(),
  findSentTickets: jest.fn(),
  getUnreadStats: jest.fn(),
  markAllRead: jest.fn(),
  markRead: jest.fn(),
  removeFamilyItems: jest.fn(),
  updateDeliveries: jest.fn(),
};
const setup = new NotificationRepository(datasource as never);
const row = {
  body: 'b',
  created_at: new Date('2026-11-23T11:00:00Z'),
  id: 'n-1',
  items: [],
  kind: 'SUMMARY',
  local_date: new Date('2026-11-23T00:00:00Z'),
  read_at: null,
  title: 't',
  user_id: 'user-1',
};
const now = new Date('2026-11-23T11:00:00Z');

beforeEach(() => jest.clearAllMocks());

it('SHOULD write the items as rows with calendar dates AND map the created notice', async () => {
  datasource.create.mockResolvedValue(row);

  const created = await setup.create(
    {
      body: 'b',
      items: [
        {
          dedupeKey: 'k',
          dueDate: '2026-11-23',
          module: 'STOCK',
          owner: 'USER' as never,
          ownerId: 'user-1',
          position: 0,
          route: '/r',
          snapshot: { description: 'x' },
          sourceId: 's',
          state: 'DUE_TODAY',
          type: 'STOCK_EXPIRING',
        },
      ],
      kind: 'SUMMARY',
      localDate: '2026-11-23',
      pushAt: now,
      title: 't',
      userId: 'user-1',
    },
    true,
  );

  expect(created.id).toBe('n-1');
  expect(datasource.create).toHaveBeenCalledWith(
    expect.objectContaining({
      items: [
        expect.objectContaining({
          dedupe_key: 'k',
          due_date: new Date('2026-11-23T00:00:00.000Z'),
        }),
      ],
      push_at: now,
      summary_done: true,
    }),
  );
});

it('SHOULD read pages, keys, deliveries, tickets and stats', async () => {
  datasource.findPage.mockResolvedValue([row]);
  datasource.findKeys.mockResolvedValue(['a', 'a', 'b']);
  datasource.findPendingDeliveries.mockResolvedValue([]);
  datasource.findSentTickets.mockResolvedValue([{ device_id: 'd', id: 'del', ticket_id: 't' }]);
  datasource.getUnreadStats.mockResolvedValue({
    count: 2,
    last_created_at: now,
    last_read_at: null,
  });

  expect(await setup.findPage({ limit: 21, userId: 'user-1' })).toHaveLength(1);
  expect([...(await setup.findKeys('user-1', '2026-11-23'))]).toEqual(['a', 'b']);
  expect(await setup.findPendingDeliveries(now, 10)).toEqual([]);
  expect(await setup.findSentTickets(now, now, 10)).toEqual([
    { deliveryId: 'del', deviceId: 'd', ticketId: 't' },
  ]);
  expect(await setup.getUnreadStats('user-1')).toEqual({
    count: 2,
    lastCreatedAt: now,
    lastReadAt: null,
  });
});

it("SHOULD answer whether the notice was the user's AND forward the other writes", async () => {
  datasource.markRead.mockResolvedValueOnce(1).mockResolvedValueOnce(0);
  datasource.cleanup.mockResolvedValue({ deliveries: 1, notices: 2 });

  expect(await setup.markRead('user-1', 'n', now)).toBe(true);
  expect(await setup.markRead('user-1', 'other', now)).toBe(false);
  await setup.markAllRead('user-1', now, now);
  await setup.removeFamilyItems('user-1', 'f1');
  await setup.removeFamilyItemsForAll('f1');
  await setup.updateDeliveries([{ attempts: 1, id: 'del', nextAttemptAt: now, status: 'PENDING' }]);

  expect(await setup.cleanup(now, now)).toEqual({ deliveries: 1, notices: 2 });
  expect(datasource.removeFamilyItems).toHaveBeenNthCalledWith(1, 'user-1', 'f1');
  expect(datasource.removeFamilyItems).toHaveBeenNthCalledWith(2, undefined, 'f1');
  expect(datasource.updateDeliveries).toHaveBeenCalledWith([
    expect.objectContaining({ attempts: 1, id: 'del', next_attempt_at: now, status: 'PENDING' }),
  ]);
});

it('SHOULD forward the account purge', async () => {
  datasource.deleteByUser.mockResolvedValue(3);

  expect(await setup.deleteByUser('user-1')).toBe(3);
});
