import { NotFoundException } from '@nestjs/common';

import { NotificationDeviceService } from './notification-device.service';

const mocks = {
  delete: { execute: jest.fn() },
  list: { execute: jest.fn() },
  register: { execute: jest.fn() },
  seen: { execute: jest.fn() },
  test: { execute: jest.fn() },
  update: { execute: jest.fn() },
};
function build(publicKey?: string) {
  return new NotificationDeviceService(
    mocks.delete as never,
    { vapidPublicKey: publicKey } as never,
    mocks.list as never,
    mocks.seen as never,
    mocks.register as never,
    mocks.test as never,
    mocks.update as never,
  );
}
const device = {
  enabled: true,
  id: 'd-1',
  lastSeenAt: new Date('2026-11-23T11:00:00Z'),
  name: 'iPhone',
  platform: 'IOS',
  provider: 'EXPO',
  token: 'ExponentPushToken[secret]',
  userId: 'user-1',
  webAuth: 'secret-auth',
  webP256dh: 'secret-key',
};

beforeEach(() => jest.resetAllMocks());

it('SHOULD list devices marking the calling one AND never return the token or the keys', async () => {
  mocks.list.execute.mockResolvedValue([device, { ...device, id: 'd-2' }]);

  const result = await build().list('user-1', 'd-2');

  expect(result.items.map((item) => [item.id, item.current])).toEqual([
    ['d-1', false],
    ['d-2', true],
  ]);
  expect(JSON.stringify(result)).not.toMatch(/secret|ExponentPushToken/);
});

it('SHOULD register with the web keys flattened AND report whether it was created', async () => {
  mocks.register.execute.mockResolvedValue({ created: false, id: 'd-1' });

  expect(
    await build().register('user-1', {
      locale: 'pt-BR',
      name: 'Chrome',
      platform: 'WEB',
      provider: 'WEB_PUSH',
      timeZone: 'America/Sao_Paulo',
      token: 'https://push.example.com/x',
      webKeys: { auth: 'a', p256dh: 'p' },
    }),
  ).toEqual({ created: false, id: 'd-1' });
  expect(mocks.register.execute).toHaveBeenCalledWith(
    expect.objectContaining({ userId: 'user-1', webAuth: 'a', webP256dh: 'p' }),
  );
});

it('SHOULD register an Expo device without web keys', async () => {
  mocks.register.execute.mockResolvedValue({ created: true, id: 'd-1' });

  await build().register('user-1', {
    locale: 'en-US',
    name: 'Pixel',
    platform: 'ANDROID',
    provider: 'EXPO',
    timeZone: 'UTC',
    token: 'ExponentPushToken[x]',
  });

  expect(mocks.register.execute).toHaveBeenCalledWith(
    expect.objectContaining({ webAuth: undefined, webP256dh: undefined }),
  );
});

it('SHOULD update, mark seen, delete AND send the test with the caller as the user', async () => {
  mocks.update.execute.mockResolvedValue({ ...device, enabled: false });

  expect((await build().update('user-1', 'd-1', { enabled: false })).enabled).toBe(false);
  await build().seen('user-1', 'd-1', { locale: 'pt-BR', timeZone: 'UTC' });
  await build().delete('user-1', 'd-1');
  await build().sendTest('user-1', undefined, 'd-1');

  expect(mocks.update.execute).toHaveBeenCalledWith({
    enabled: false,
    id: 'd-1',
    userId: 'user-1',
  });
  expect(mocks.seen.execute).toHaveBeenCalledWith({
    id: 'd-1',
    locale: 'pt-BR',
    timeZone: 'UTC',
    userId: 'user-1',
  });
  expect(mocks.delete.execute).toHaveBeenCalledWith({ id: 'd-1', userId: 'user-1' });
  expect(mocks.test.execute).toHaveBeenCalledWith({
    currentDeviceId: 'd-1',
    deviceId: undefined,
    userId: 'user-1',
  });
});

it('SHOULD answer the VAPID public key AND 404 WHEN Web Push is not configured', () => {
  expect(build('BPublic').webPushKey()).toEqual({ publicKey: 'BPublic' });
  expect(() => build().webPushKey()).toThrow(NotFoundException);
});
