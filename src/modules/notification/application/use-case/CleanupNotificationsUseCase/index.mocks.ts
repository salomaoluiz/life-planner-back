import { Test } from '@nestjs/testing';

import { CleanupNotificationsUseCase } from './index';

// region Mocks

const notificationRepositoryMock = { cleanup: jest.fn() };
const notificationDeviceRepositoryMock = { deleteStale: jest.fn() };

// endregion Mocks

let setup: CleanupNotificationsUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  notificationRepositoryMock.cleanup.mockResolvedValue({ deliveries: 1, notices: 2 });
  notificationDeviceRepositoryMock.deleteStale.mockResolvedValue(3);
  const module = await Test.createTestingModule({
    providers: [
      CleanupNotificationsUseCase,
      { provide: 'INotificationRepository', useValue: notificationRepositoryMock },
      { provide: 'INotificationDeviceRepository', useValue: notificationDeviceRepositoryMock },
    ],
  }).compile();

  setup = module.get(CleanupNotificationsUseCase);
});

const mocks = {
  notificationDeviceRepository: notificationDeviceRepositoryMock,
  notificationRepository: notificationRepositoryMock,
};

export { mocks, setup };
