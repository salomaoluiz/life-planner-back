import { Database } from '@shared/infra/db/Database';

import { NotificationDeviceDatasource } from './index';

const model = {
  deleteMany: jest.fn(),
  findMany: jest.fn(),
  findUnique: jest.fn(),
  update: jest.fn(),
  updateMany: jest.fn(),
  upsert: jest.fn(),
};
const setup = new NotificationDeviceDatasource({
  client: { notificationDevice: model },
} as unknown as Database);
const now = new Date('2026-11-23T11:00:00Z');

beforeEach(() => jest.clearAllMocks());

it('SHOULD upsert by token AND refresh last_seen_at', async () => {
  const data = {
    name: 'n',
    platform: 'WEB',
    provider: 'WEB_PUSH',
    token: 't',
    user_id: 'u',
    web_auth: 'a',
    web_p256dh: 'p',
  } as const;

  await setup.upsert(data, now);

  expect(model.upsert).toHaveBeenCalledWith({
    create: { ...data, last_seen_at: now },
    update: { ...data, last_seen_at: now },
    where: { token: 't' },
  });
});

it('SHOULD delete by id, by ids (nothing for an empty list) AND the stale ones', async () => {
  model.deleteMany.mockResolvedValue({ count: 3 });

  await setup.delete('d');
  await setup.deleteMany([]);
  await setup.deleteMany(['a', 'b']);

  expect(await setup.deleteStale(now)).toBe(3);
  expect(model.deleteMany).toHaveBeenCalledTimes(3);
  expect(model.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ['a', 'b'] } } });
  expect(model.deleteMany).toHaveBeenCalledWith({ where: { last_seen_at: { lt: now } } });
});

it('SHOULD read, touch and update a device', async () => {
  await setup.findById('d');
  await setup.findByToken('t');
  await setup.findByUser('u');
  await setup.touch('d', now);
  await setup.update('d', { enabled: false });

  expect(model.findUnique).toHaveBeenCalledWith({ where: { id: 'd' } });
  expect(model.findUnique).toHaveBeenCalledWith({ where: { token: 't' } });
  expect(model.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { user_id: 'u' } }));
  expect(model.updateMany).toHaveBeenCalledWith({
    data: { last_seen_at: now },
    where: { id: 'd' },
  });
  expect(model.update).toHaveBeenCalledWith({ data: { enabled: false }, where: { id: 'd' } });
});
