import { Test } from '@nestjs/testing';

import { GetNotificationPreferencesUseCase } from './index';

// region Mocks

const notificationPreferenceRepositoryMock = { find: jest.fn(), findDisabledFamilyIds: jest.fn() };

// endregion Mocks

let setup: GetNotificationPreferencesUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  notificationPreferenceRepositoryMock.findDisabledFamilyIds.mockResolvedValue(new Map());
  const module = await Test.createTestingModule({
    providers: [
      GetNotificationPreferencesUseCase,
      {
        provide: 'INotificationPreferenceRepository',
        useValue: notificationPreferenceRepositoryMock,
      },
    ],
  }).compile();

  setup = module.get(GetNotificationPreferencesUseCase);
});

const mocks = { notificationPreferenceRepository: notificationPreferenceRepositoryMock };

export { mocks, setup };
