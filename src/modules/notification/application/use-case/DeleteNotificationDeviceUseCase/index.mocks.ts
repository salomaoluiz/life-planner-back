import { Test } from '@nestjs/testing';

import { DeleteNotificationDeviceUseCase } from './index';

// region Mocks

const notificationDeviceRepositoryMock = { delete: jest.fn(), findById: jest.fn() };

// endregion Mocks

let setup: DeleteNotificationDeviceUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  notificationDeviceRepositoryMock.findById.mockResolvedValue({ id: 'd-1', userId: 'user-1' });
  const module = await Test.createTestingModule({
    providers: [
      DeleteNotificationDeviceUseCase,
      { provide: 'INotificationDeviceRepository', useValue: notificationDeviceRepositoryMock },
    ],
  }).compile();

  setup = module.get(DeleteNotificationDeviceUseCase);
});

const mocks = { notificationDeviceRepository: notificationDeviceRepositoryMock };

export { mocks, setup };
