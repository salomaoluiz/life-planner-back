import { PendingDelivery } from '@notification/domain/entity/NotificationEntity';

import { mocks, setup } from './index.mocks';

const now = new Date('2026-11-23T11:00:00Z');
function delivery(id: string, overrides: Partial<PendingDelivery> = {}): PendingDelivery {
  return {
    attempts: 0,
    body: 'Iogurte natural',
    deviceId: `device-${id}`,
    id,
    notificationId: 'n-1',
    provider: 'EXPO',
    route: '/notifications',
    title: 'Hoje: 1 avisos',
    token: `ExponentPushToken[${id}]`,
    webAuth: null,
    webP256dh: null,
    ...overrides,
  };
}
function web(id: string, attempts = 0) {
  return delivery(id, {
    attempts,
    provider: 'WEB_PUSH',
    token: `https://push.example.com/${id}`,
    webAuth: 'a',
    webP256dh: 'p',
  });
}

it('SHOULD send Expo pushes with the payload of the notice AND store the ticket ids as SENT', async () => {
  mocks.notificationRepository.findPendingDeliveries.mockResolvedValue([
    delivery('a'),
    delivery('b'),
  ]);

  expect(await setup.execute({ now })).toEqual({ failed: 0, invalid: 0, retried: 0, sent: 2 });

  expect(mocks.pushSender.sendExpo).toHaveBeenCalledWith([
    {
      body: 'Iogurte natural',
      data: { notificationId: 'n-1', route: '/notifications' },
      title: 'Hoje: 1 avisos',
      to: 'ExponentPushToken[a]',
    },
    expect.objectContaining({ to: 'ExponentPushToken[b]' }),
  ]);
  expect(mocks.notificationRepository.updateDeliveries).toHaveBeenCalledWith([
    { id: 'a', sentAt: now, status: 'SENT', ticketId: 'ticket-0' },
    { id: 'b', sentAt: now, status: 'SENT', ticketId: 'ticket-1' },
  ]);
});

it('SHOULD send Expo messages in batches of 100', async () => {
  mocks.notificationRepository.findPendingDeliveries.mockResolvedValue(
    Array.from({ length: 250 }, (_, index) => delivery(`d-${index}`)),
  );

  await setup.execute({ now });

  expect(mocks.pushSender.sendExpo.mock.calls.map((call) => call[0].length)).toEqual([
    100, 100, 50,
  ]);
});

it('SHOULD mark INVALID AND delete the device WHEN Expo says DeviceNotRegistered', async () => {
  mocks.notificationRepository.findPendingDeliveries.mockResolvedValue([delivery('a')]);
  mocks.pushSender.sendExpo.mockResolvedValue([{ error: 'DeviceNotRegistered', status: 'error' }]);

  expect((await setup.execute({ now })).invalid).toBe(1);
  expect(mocks.notificationRepository.updateDeliveries).toHaveBeenCalledWith([
    { error: 'DeviceNotRegistered', id: 'a', status: 'INVALID' },
  ]);
  expect(mocks.notificationDeviceRepository.deleteMany).toHaveBeenCalledWith(['device-a']);
});

it('SHOULD retry an Expo request failure after 1 minute AND treat a missing ticket as a failure', async () => {
  mocks.notificationRepository.findPendingDeliveries.mockResolvedValue([
    delivery('a'),
    delivery('b'),
  ]);
  mocks.pushSender.sendExpo.mockResolvedValue([{ error: 'RequestFailed', status: 'error' }]);

  expect((await setup.execute({ now })).retried).toBe(2);
  expect(mocks.notificationRepository.updateDeliveries).toHaveBeenCalledWith([
    {
      attempts: 1,
      error: 'RequestFailed',
      id: 'a',
      nextAttemptAt: new Date('2026-11-23T11:01:00.000Z'),
      status: 'PENDING',
    },
    {
      attempts: 1,
      error: 'NoTicket',
      id: 'b',
      nextAttemptAt: new Date('2026-11-23T11:01:00.000Z'),
      status: 'PENDING',
    },
  ]);
});

it('SHOULD send Web Push with the stored keys AND mark SENT', async () => {
  mocks.notificationRepository.findPendingDeliveries.mockResolvedValue([web('w')]);

  expect((await setup.execute({ now })).sent).toBe(1);
  expect(mocks.pushSender.sendWeb).toHaveBeenCalledWith(
    { auth: 'a', endpoint: 'https://push.example.com/w', p256dh: 'p' },
    {
      body: 'Iogurte natural',
      data: { notificationId: 'n-1', route: '/notifications' },
      title: 'Hoje: 1 avisos',
    },
  );
  expect(mocks.notificationDeviceRepository.deleteMany).not.toHaveBeenCalled();
});

it('SHOULD send Web Push with at most 20 requests in flight', async () => {
  let inFlight = 0;
  let peak = 0;
  mocks.pushSender.sendWeb.mockImplementation(async () => {
    inFlight += 1;
    peak = Math.max(peak, inFlight);
    await Promise.resolve();
    inFlight -= 1;

    return { ok: true };
  });
  mocks.notificationRepository.findPendingDeliveries.mockResolvedValue(
    Array.from({ length: 45 }, (_, index) => web(`w-${index}`)),
  );

  await setup.execute({ now });

  expect(peak).toBe(20);
  expect(mocks.pushSender.sendWeb).toHaveBeenCalledTimes(45);
});

it('SHOULD mark INVALID AND delete the device WHEN the Web Push endpoint is gone (404/410)', async () => {
  mocks.notificationRepository.findPendingDeliveries.mockResolvedValue([web('w')]);
  mocks.pushSender.sendWeb.mockResolvedValue({ gone: true });

  expect((await setup.execute({ now })).invalid).toBe(1);
  expect(mocks.notificationDeviceRepository.deleteMany).toHaveBeenCalledWith(['device-w']);
});

it.each([
  [0, 'PENDING', '2026-11-23T11:01:00.000Z'],
  [1, 'PENDING', '2026-11-23T11:05:00.000Z'],
  [2, 'PENDING', '2026-11-23T11:15:00.000Z'],
  [3, 'FAILED', undefined],
])(
  'SHOULD handle a Web Push 503 after %i earlier attempts as %s',
  async (attempts, status, next) => {
    mocks.notificationRepository.findPendingDeliveries.mockResolvedValue([web('w', attempts)]);
    mocks.pushSender.sendWeb.mockResolvedValue({ retry: true });

    await setup.execute({ now });

    expect(mocks.notificationRepository.updateDeliveries).toHaveBeenCalledWith([
      expect.objectContaining({
        attempts: attempts + 1,
        nextAttemptAt: next ? new Date(next) : undefined,
        status,
      }),
    ]);
  },
);

it('SHOULD do nothing but an empty update WHEN nothing is pending, AND default to the current time', async () => {
  expect(await setup.execute()).toEqual({ failed: 0, invalid: 0, retried: 0, sent: 0 });
  expect(mocks.pushSender.sendExpo).not.toHaveBeenCalled();
  expect(mocks.pushSender.sendWeb).not.toHaveBeenCalled();
});
