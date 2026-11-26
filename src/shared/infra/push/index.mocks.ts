import { EnvService } from '@shared/infra/env/env.service';

const expo = {
  chunkPushNotificationReceiptIds: jest.fn((ids: string[]) => [ids]),
  chunkPushNotifications: jest.fn((messages: unknown[]) => [messages]),
  getPushNotificationReceiptsAsync: jest.fn(),
  sendPushNotificationsAsync: jest.fn(),
};
function envWith(overrides: Record<string, unknown> = {}) {
  return {
    expoAccessToken: undefined,
    vapidPrivateKey: 'private',
    vapidPublicKey: 'public',
    vapidSubject: 'mailto:you@example.com',
    ...overrides,
  } as unknown as EnvService;
}
const payload = { body: 'b', data: { notificationId: 'n', route: '/r' }, title: 't' };
const subscription = { auth: 'a', endpoint: 'https://push.example.com/x', p256dh: 'p' };

export { envWith, expo, payload, subscription };
