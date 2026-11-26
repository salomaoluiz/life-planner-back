import { Test } from '@nestjs/testing';

import { ListNotificationsUseCase } from './index';

// region Mocks

const notificationRepositoryMock = { findPage: jest.fn() };

// endregion Mocks

let setup: ListNotificationsUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  notificationRepositoryMock.findPage.mockResolvedValue([]);
  const module = await Test.createTestingModule({
    providers: [
      ListNotificationsUseCase,
      { provide: 'INotificationRepository', useValue: notificationRepositoryMock },
    ],
  }).compile();

  setup = module.get(ListNotificationsUseCase);
});

const mocks = { notificationRepository: notificationRepositoryMock };

export { mocks, setup };
