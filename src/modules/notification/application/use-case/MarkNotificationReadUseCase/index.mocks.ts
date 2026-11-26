import { Test } from '@nestjs/testing';

import { MarkNotificationReadUseCase } from './index';

// region Mocks

const notificationRepositoryMock = { markRead: jest.fn() };

// endregion Mocks

let setup: MarkNotificationReadUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  notificationRepositoryMock.markRead.mockResolvedValue(true);
  const module = await Test.createTestingModule({
    providers: [
      MarkNotificationReadUseCase,
      { provide: 'INotificationRepository', useValue: notificationRepositoryMock },
    ],
  }).compile();

  setup = module.get(MarkNotificationReadUseCase);
});

const mocks = { notificationRepository: notificationRepositoryMock };

export { mocks, setup };
