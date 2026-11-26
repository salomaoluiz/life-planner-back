import { NotificationDeviceRepository } from './index';

const row = {
  enabled: true,
  id: 'd-1',
  last_seen_at: new Date('2026-11-23T11:00:00Z'),
  name: 'iPhone',
  platform: 'IOS',
  provider: 'EXPO',
  token: 'ExponentPushToken[x]',
  user_id: 'user-1',
  web_auth: null,
  web_p256dh: null,
};
const datasource = {
  delete: jest.fn(),
  deleteMany: jest.fn(),
  deleteStale: jest.fn(),
  findById: jest.fn(),
  findByToken: jest.fn(),
  findByUser: jest.fn(),
  touch: jest.fn(),
  update: jest.fn(),
  upsert: jest.fn(),
};
const setup = new NotificationDeviceRepository(datasource as never);
const params = {
  name: 'iPhone',
  platform: 'IOS',
  provider: 'EXPO',
  token: 'ExponentPushToken[x]',
  userId: 'user-1',
} as const;

beforeEach(() => jest.clearAllMocks());

it('SHOULD tell a new registration from an upsert of the same token', async () => {
  datasource.upsert.mockResolvedValue(row);
  datasource.findByToken.mockResolvedValueOnce(null).mockResolvedValueOnce(row);

  expect((await setup.register(params, new Date())).created).toBe(true);
  expect((await setup.register(params, new Date())).created).toBe(false);
  expect(datasource.upsert).toHaveBeenCalledWith(
    expect.objectContaining({ user_id: 'user-1', web_auth: null, web_p256dh: null }),
    expect.any(Date),
  );
});

it('SHOULD map reads AND answer undefined WHEN the device does not exist', async () => {
  datasource.findById.mockResolvedValueOnce(row).mockResolvedValueOnce(null);
  datasource.findByUser.mockResolvedValue([row]);

  expect(await setup.findById('d-1')).toEqual(
    expect.objectContaining({ id: 'd-1', userId: 'user-1' }),
  );
  expect(await setup.findById('x')).toBeUndefined();
  expect(await setup.findByUser('user-1')).toHaveLength(1);
});

it('SHOULD forward updates, seen marks and deletes', async () => {
  datasource.update.mockResolvedValue({ ...row, enabled: false });
  datasource.deleteStale.mockResolvedValue(2);
  const now = new Date();

  expect((await setup.update('d-1', { enabled: false })).enabled).toBe(false);
  await setup.markSeen('d-1', now);
  await setup.delete('d-1');
  await setup.deleteMany(['a']);

  expect(await setup.deleteStale(now)).toBe(2);
  expect(datasource.touch).toHaveBeenCalledWith('d-1', now);
  expect(datasource.delete).toHaveBeenCalledWith('d-1');
  expect(datasource.deleteMany).toHaveBeenCalledWith(['a']);
});
