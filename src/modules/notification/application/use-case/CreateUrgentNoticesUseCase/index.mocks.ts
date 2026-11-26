import { Test } from '@nestjs/testing';

import { CreateUrgentNoticesUseCase } from './index';

// region Mocks

const notificationRepositoryMock = { create: jest.fn(), findKeys: jest.fn() };

// endregion Mocks

let setup: CreateUrgentNoticesUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  notificationRepositoryMock.findKeys.mockResolvedValue(new Set());
  const module = await Test.createTestingModule({
    providers: [
      CreateUrgentNoticesUseCase,
      { provide: 'INotificationRepository', useValue: notificationRepositoryMock },
    ],
  }).compile();

  setup = module.get(CreateUrgentNoticesUseCase);
});

const mocks = { notificationRepository: notificationRepositoryMock };

export { mocks, setup };
