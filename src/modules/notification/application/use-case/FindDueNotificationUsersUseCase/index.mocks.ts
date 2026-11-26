import { Test } from '@nestjs/testing';

import { FindDueNotificationUsersUseCase } from './index';

// region Mocks

const notificationPreferenceRepositoryMock = {
  findDisabledFamilyIds: jest.fn(),
  findDueUsers: jest.fn(),
};

// endregion Mocks

let setup: FindDueNotificationUsersUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  notificationPreferenceRepositoryMock.findDisabledFamilyIds.mockResolvedValue(new Map());
  notificationPreferenceRepositoryMock.findDueUsers.mockResolvedValue([]);
  const module = await Test.createTestingModule({
    providers: [
      FindDueNotificationUsersUseCase,
      {
        provide: 'INotificationPreferenceRepository',
        useValue: notificationPreferenceRepositoryMock,
      },
    ],
  }).compile();

  setup = module.get(FindDueNotificationUsersUseCase);
});

const mocks = { notificationPreferenceRepository: notificationPreferenceRepositoryMock };

export { mocks, setup };
