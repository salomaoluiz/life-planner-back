import { Test } from '@nestjs/testing';

import { defaultPreferences } from '@notification/domain/entity/NotificationPreferences';

import { UpdateNotificationPreferencesUseCase } from './index';

// region Mocks

const notificationPreferenceRepositoryMock = {
  find: jest.fn(),
  findDisabledFamilyIds: jest.fn(),
  save: jest.fn(),
  setFamilyEnabled: jest.fn(),
};

// endregion Mocks

let setup: UpdateNotificationPreferencesUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  notificationPreferenceRepositoryMock.find.mockResolvedValue(defaultPreferences('user-1'));
  notificationPreferenceRepositoryMock.save.mockImplementation(
    async (_userId: string, patch: object) => ({ ...defaultPreferences('user-1'), ...patch }),
  );
  notificationPreferenceRepositoryMock.findDisabledFamilyIds.mockResolvedValue(new Map());
  const module = await Test.createTestingModule({
    providers: [
      UpdateNotificationPreferencesUseCase,
      {
        provide: 'INotificationPreferenceRepository',
        useValue: notificationPreferenceRepositoryMock,
      },
    ],
  }).compile();

  setup = module.get(UpdateNotificationPreferencesUseCase);
});

const mocks = { notificationPreferenceRepository: notificationPreferenceRepositoryMock };

export { mocks, setup };
