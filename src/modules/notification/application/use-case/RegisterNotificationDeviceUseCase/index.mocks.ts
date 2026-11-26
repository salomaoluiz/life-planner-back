import { Test } from '@nestjs/testing';

import { RegisterNotificationDeviceUseCase } from './index';

// region Mocks

const notificationDeviceRepositoryMock = { register: jest.fn() };
const notificationPreferenceRepositoryMock = { save: jest.fn() };

// endregion Mocks

let setup: RegisterNotificationDeviceUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  notificationDeviceRepositoryMock.register.mockResolvedValue({
    created: true,
    device: { id: 'd-1' },
  });
  const module = await Test.createTestingModule({
    providers: [
      RegisterNotificationDeviceUseCase,
      { provide: 'INotificationDeviceRepository', useValue: notificationDeviceRepositoryMock },
      {
        provide: 'INotificationPreferenceRepository',
        useValue: notificationPreferenceRepositoryMock,
      },
    ],
  }).compile();

  setup = module.get(RegisterNotificationDeviceUseCase);
});

const mocks = {
  notificationDeviceRepository: notificationDeviceRepositoryMock,
  notificationPreferenceRepository: notificationPreferenceRepositoryMock,
};

export { mocks, setup };
