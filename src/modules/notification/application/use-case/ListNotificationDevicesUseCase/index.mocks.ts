import { Test } from '@nestjs/testing';

import { ListNotificationDevicesUseCase } from './index';

// region Mocks

const notificationDeviceRepositoryMock = { findByUser: jest.fn() };

// endregion Mocks

let setup: ListNotificationDevicesUseCase;

beforeEach(async () => {
  jest.clearAllMocks();

  const module = await Test.createTestingModule({
    providers: [
      ListNotificationDevicesUseCase,
      { provide: 'INotificationDeviceRepository', useValue: notificationDeviceRepositoryMock },
    ],
  }).compile();

  setup = module.get(ListNotificationDevicesUseCase);
});

const mocks = { notificationDeviceRepository: notificationDeviceRepositoryMock };

export { mocks, setup };
