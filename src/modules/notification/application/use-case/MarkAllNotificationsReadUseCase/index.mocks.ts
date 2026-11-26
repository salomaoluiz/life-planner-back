import { Test } from '@nestjs/testing';

import { MarkAllNotificationsReadUseCase } from './index';

// region Mocks

const notificationRepositoryMock = { markAllRead: jest.fn() };

// endregion Mocks

let setup: MarkAllNotificationsReadUseCase;

beforeEach(async () => {
  jest.clearAllMocks();

  const module = await Test.createTestingModule({
    providers: [
      MarkAllNotificationsReadUseCase,
      { provide: 'INotificationRepository', useValue: notificationRepositoryMock },
    ],
  }).compile();

  setup = module.get(MarkAllNotificationsReadUseCase);
});

const mocks = { notificationRepository: notificationRepositoryMock };

export { mocks, setup };
