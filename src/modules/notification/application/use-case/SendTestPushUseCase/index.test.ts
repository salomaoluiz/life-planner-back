import { HttpException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';

import { TEST_PUSH_LIMIT } from '@notification/domain/service/DeliveryRetry';

import { mocks, setup } from './index.mocks';

it('SHOULD send the localized test push to the chosen Expo device WITHOUT storing anything', async () => {
  await setup.execute({ deviceId: 'd-1', userId: 'user-1' });

  expect(mocks.pushSender.sendExpo).toHaveBeenCalledWith([
    {
      body: '',
      data: { notificationId: 'test', route: '/notifications' },
      title: 'Notificações funcionando',
      to: 'ExponentPushToken[abc]',
    },
  ]);
});

it('SHOULD default to the calling device AND send Web Push with the stored keys', async () => {
  mocks.notificationDeviceRepository.findById.mockResolvedValue(mocks.webDevice);

  await setup.execute({ currentDeviceId: 'd-2', userId: 'user-1' });

  expect(mocks.notificationDeviceRepository.findById).toHaveBeenCalledWith('d-2');
  expect(mocks.pushSender.sendWeb).toHaveBeenCalledWith(
    { auth: 'a', endpoint: 'https://push.example.com/x', p256dh: 'p' },
    expect.objectContaining({ title: 'Notificações funcionando' }),
  );
});

it('SHOULD delete the device WHEN the provider says it is gone', async () => {
  mocks.pushSender.sendExpo.mockResolvedValue([{ error: 'DeviceNotRegistered', status: 'error' }]);
  await setup.execute({ deviceId: 'd-1', userId: 'user-1' });
  mocks.notificationDeviceRepository.findById.mockResolvedValue(mocks.webDevice);
  mocks.pushSender.sendWeb.mockResolvedValue({ gone: true });
  await setup.execute({ deviceId: 'd-2', userId: 'user-1' });

  expect(mocks.notificationDeviceRepository.delete).toHaveBeenCalledWith('d-1');
  expect(mocks.notificationDeviceRepository.delete).toHaveBeenCalledWith('d-2');
});

it("SHOULD answer 404 for another user's device or no device at all, AND 422 for a turned off one", async () => {
  await expect(setup.execute({ deviceId: 'd-1', userId: 'someone-else' })).rejects.toBeInstanceOf(
    NotFoundException,
  );
  await expect(setup.execute({ userId: 'user-1' })).rejects.toBeInstanceOf(NotFoundException);
  mocks.notificationDeviceRepository.findById.mockResolvedValue({
    ...mocks.expoDevice,
    enabled: false,
  });
  await expect(setup.execute({ deviceId: 'd-1', userId: 'user-1' })).rejects.toBeInstanceOf(
    UnprocessableEntityException,
  );
  expect(mocks.pushSender.sendExpo).not.toHaveBeenCalled();
});

it('SHOULD answer 429 once the hourly test push limit is reached AND allow it again later', async () => {
  const at = new Date('2026-11-23T11:00:00Z');

  for (let index = 0; index < TEST_PUSH_LIMIT; index += 1) {
    await setup.execute({ deviceId: 'd-1', now: at, userId: 'user-1' });
  }

  await expect(
    setup.execute({ deviceId: 'd-1', now: at, userId: 'user-1' }),
  ).rejects.toBeInstanceOf(HttpException);
  await expect(
    setup.execute({ deviceId: 'd-1', now: new Date(at.getTime() + 3_600_001), userId: 'user-1' }),
  ).resolves.toBeUndefined();
});
