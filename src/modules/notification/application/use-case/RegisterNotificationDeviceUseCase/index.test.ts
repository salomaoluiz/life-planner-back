import { ValidationError } from '@shared/domain/error/ValidationError';

import { mocks, setup } from './index.mocks';

const expo = {
  locale: 'pt-BR',
  name: 'iPhone',
  platform: 'IOS',
  provider: 'EXPO',
  timeZone: 'America/Sao_Paulo',
  token: 'ExponentPushToken[abc]',
  userId: 'user-1',
} as const;
const web = {
  ...expo,
  name: 'Chrome no Mac',
  platform: 'WEB',
  provider: 'WEB_PUSH',
  token: 'https://push.example.com/x',
  webAuth: 'auth',
  webP256dh: 'p256dh',
} as const;

it('SHOULD register the device AND copy the time zone and locale to the user preferences', async () => {
  const now = new Date('2026-11-23T11:00:00Z');

  expect(await setup.execute({ ...expo, now })).toEqual({ created: true, id: 'd-1' });
  expect(mocks.notificationDeviceRepository.register).toHaveBeenCalledWith(
    {
      name: 'iPhone',
      platform: 'IOS',
      provider: 'EXPO',
      token: 'ExponentPushToken[abc]',
      userId: 'user-1',
    },
    now,
  );
  expect(mocks.notificationPreferenceRepository.save).toHaveBeenCalledWith('user-1', {
    locale: 'pt-BR',
    timeZone: 'America/Sao_Paulo',
  });
});

it('SHOULD report an upsert WHEN the token already exists', async () => {
  mocks.notificationDeviceRepository.register.mockResolvedValue({
    created: false,
    device: { id: 'd-9' },
  });

  expect(await setup.execute(web)).toEqual({ created: false, id: 'd-9' });
});

it.each([
  ['an Expo token of another shape', { ...expo, token: 'not-a-token' }],
  ['a Web Push endpoint that is not https', { ...web, token: 'http://push.example.com/x' }],
  ['a Web Push device without keys', { ...web, webAuth: undefined }],
  ['an Expo device on the web platform', { ...expo, platform: 'WEB' }],
  ['an unknown time zone', { ...expo, timeZone: 'Mars/Base' }],
])('SHOULD answer 400 for %s', async (_title, input) => {
  await expect(setup.execute(input as never)).rejects.toBeInstanceOf(ValidationError);
  expect(mocks.notificationDeviceRepository.register).not.toHaveBeenCalled();
});
