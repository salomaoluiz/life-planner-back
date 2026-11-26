import { Test } from '@nestjs/testing';

import { SendTestPushUseCase } from './index';

// region Mocks

const notificationDeviceRepositoryMock = { delete: jest.fn(), findById: jest.fn() };
const notificationPreferenceRepositoryMock = { find: jest.fn() };
const pushSenderMock = { sendExpo: jest.fn(), sendWeb: jest.fn() };

const expoDevice = {
  enabled: true,
  id: 'd-1',
  provider: 'EXPO',
  token: 'ExponentPushToken[abc]',
  userId: 'user-1',
};
const webDevice = {
  ...expoDevice,
  id: 'd-2',
  provider: 'WEB_PUSH',
  token: 'https://push.example.com/x',
  webAuth: 'a',
  webP256dh: 'p',
};

// endregion Mocks

let setup: SendTestPushUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  notificationDeviceRepositoryMock.findById.mockResolvedValue(expoDevice);
  notificationPreferenceRepositoryMock.find.mockResolvedValue({ locale: 'pt-BR' });
  pushSenderMock.sendExpo.mockResolvedValue([{ id: 't', status: 'ok' }]);
  pushSenderMock.sendWeb.mockResolvedValue({ ok: true });
  const module = await Test.createTestingModule({
    providers: [
      SendTestPushUseCase,
      { provide: 'INotificationDeviceRepository', useValue: notificationDeviceRepositoryMock },
      {
        provide: 'INotificationPreferenceRepository',
        useValue: notificationPreferenceRepositoryMock,
      },
      { provide: 'IPushSender', useValue: pushSenderMock },
    ],
  }).compile();

  setup = module.get(SendTestPushUseCase);
});

const mocks = {
  expoDevice,
  notificationDeviceRepository: notificationDeviceRepositoryMock,
  notificationPreferenceRepository: notificationPreferenceRepositoryMock,
  pushSender: pushSenderMock,
  webDevice,
};

export { mocks, setup };
