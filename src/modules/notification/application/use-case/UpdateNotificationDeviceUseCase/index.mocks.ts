import { Test } from '@nestjs/testing';

import { UpdateNotificationDeviceUseCase } from './index';

// region Mocks

const notificationDeviceRepositoryMock = { findById: jest.fn(), update: jest.fn() };

// endregion Mocks

let setup: UpdateNotificationDeviceUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  notificationDeviceRepositoryMock.findById.mockResolvedValue({ id: 'd-1', userId: 'user-1' });
  notificationDeviceRepositoryMock.update.mockResolvedValue({ enabled: false, id: 'd-1' });
  const module = await Test.createTestingModule({
    providers: [
      UpdateNotificationDeviceUseCase,
      { provide: 'INotificationDeviceRepository', useValue: notificationDeviceRepositoryMock },
    ],
  }).compile();

  setup = module.get(UpdateNotificationDeviceUseCase);
});

const mocks = { notificationDeviceRepository: notificationDeviceRepositoryMock };

export { mocks, setup };
