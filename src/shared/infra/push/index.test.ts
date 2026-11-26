import { Expo } from 'expo-server-sdk';
import * as webpush from 'web-push';

import { PushSender } from './index';
import { envWith, expo, payload, subscription } from './index.mocks';

jest.mock('expo-server-sdk', () => ({ Expo: jest.fn() }));
jest.mock('web-push', () => ({ sendNotification: jest.fn() }));

const sendNotification = jest.mocked(webpush.sendNotification);

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(Expo).mockImplementation(() => expo as never);
});

describe('sendExpo', () => {
  it('SHOULD map the tickets of every chunk in order', async () => {
    expo.sendPushNotificationsAsync.mockResolvedValue([
      { id: 'ticket-1', status: 'ok' },
      { details: { error: 'DeviceNotRegistered' }, message: 'x', status: 'error' },
      { message: 'x', status: 'error' },
    ]);

    const tickets = await new PushSender(envWith()).sendExpo([
      { ...payload, to: 'a' },
      { ...payload, to: 'b' },
      { ...payload, to: 'c' },
    ]);

    expect(tickets).toEqual([
      { id: 'ticket-1', status: 'ok' },
      { error: 'DeviceNotRegistered', status: 'error' },
      { error: 'RequestFailed', status: 'error' },
    ]);
  });

  it('SHOULD answer RequestFailed for every message of a chunk that threw', async () => {
    expo.sendPushNotificationsAsync.mockRejectedValue(new Error('down'));

    const tickets = await new PushSender(envWith()).sendExpo([{ ...payload, to: 'a' }]);

    expect(tickets).toEqual([{ error: 'RequestFailed', status: 'error' }]);
  });
});

describe('getExpoReceipts', () => {
  it('SHOULD map ok and error receipts', async () => {
    expo.getPushNotificationReceiptsAsync.mockResolvedValue({
      a: { status: 'ok' },
      b: { details: { error: 'DeviceNotRegistered' }, message: 'm', status: 'error' },
      c: { message: 'plain', status: 'error' },
    });

    expect(await new PushSender(envWith()).getExpoReceipts(['a', 'b', 'c'])).toEqual({
      a: { status: 'ok' },
      b: { error: 'DeviceNotRegistered', status: 'error' },
      c: { error: 'plain', status: 'error' },
    });
  });

  it('SHOULD leave the ids of a failing chunk out', async () => {
    expo.getPushNotificationReceiptsAsync.mockRejectedValue(new Error('down'));

    expect(await new PushSender(envWith()).getExpoReceipts(['a'])).toEqual({});
  });
});

describe('sendWeb', () => {
  it('SHOULD send the JSON payload with the VAPID details', async () => {
    sendNotification.mockResolvedValue({} as never);

    expect(await new PushSender(envWith()).sendWeb(subscription, payload)).toEqual({ ok: true });
    expect(sendNotification).toHaveBeenCalledWith(
      { endpoint: subscription.endpoint, keys: { auth: 'a', p256dh: 'p' } },
      JSON.stringify(payload),
      expect.objectContaining({
        vapidDetails: expect.objectContaining({ subject: 'mailto:you@example.com' }),
      }),
    );
  });

  it.each([404, 410])('SHOULD answer gone WHEN the endpoint answers %s', async (statusCode) => {
    sendNotification.mockRejectedValue(Object.assign(new Error('x'), { statusCode }));

    expect(await new PushSender(envWith()).sendWeb(subscription, payload)).toEqual({ gone: true });
  });

  it.each([429, 503, undefined])(
    'SHOULD answer retry WHEN it fails with %s',
    async (statusCode) => {
      sendNotification.mockRejectedValue(Object.assign(new Error('x'), { statusCode }));

      expect(await new PushSender(envWith()).sendWeb(subscription, payload)).toEqual({
        retry: true,
      });
    },
  );

  it('SHOULD answer retry WITHOUT calling the provider WHEN the VAPID keys are missing', async () => {
    const sender = new PushSender(envWith({ vapidPrivateKey: undefined }));

    expect(await sender.sendWeb(subscription, payload)).toEqual({ retry: true });
    expect(sendNotification).not.toHaveBeenCalled();
  });
});
