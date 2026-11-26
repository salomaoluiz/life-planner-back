import { Test } from '@nestjs/testing';

import { GetUnreadStatsUseCase } from './index';

// region Mocks

const notificationRepositoryMock = { getUnreadStats: jest.fn() };

// endregion Mocks

let setup: GetUnreadStatsUseCase;

beforeEach(async () => {
  jest.clearAllMocks();

  const module = await Test.createTestingModule({
    providers: [
      GetUnreadStatsUseCase,
      { provide: 'INotificationRepository', useValue: notificationRepositoryMock },
    ],
  }).compile();

  setup = module.get(GetUnreadStatsUseCase);
});

const mocks = { notificationRepository: notificationRepositoryMock };

export { mocks, setup };
