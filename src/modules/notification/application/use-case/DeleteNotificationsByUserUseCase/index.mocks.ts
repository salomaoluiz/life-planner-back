import { Test } from '@nestjs/testing';

import { DeleteNotificationsByUserUseCase } from './index';

// region Mocks

const notificationRepositoryMock = { deleteByUser: jest.fn(), removeFamilyItemsForAll: jest.fn() };

// endregion Mocks

let setup: DeleteNotificationsByUserUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  notificationRepositoryMock.deleteByUser.mockResolvedValue(4);
  const module = await Test.createTestingModule({
    providers: [
      DeleteNotificationsByUserUseCase,
      { provide: 'INotificationRepository', useValue: notificationRepositoryMock },
    ],
  }).compile();

  setup = module.get(DeleteNotificationsByUserUseCase);
});

const mocks = { notificationRepository: notificationRepositoryMock };

export { mocks, setup };
