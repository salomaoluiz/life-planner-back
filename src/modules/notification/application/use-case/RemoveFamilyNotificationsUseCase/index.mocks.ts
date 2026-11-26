import { Test } from '@nestjs/testing';

import { RemoveFamilyNotificationsUseCase } from './index';

// region Mocks

const notificationRepositoryMock = {
  removeFamilyItems: jest.fn(),
  removeFamilyItemsForAll: jest.fn(),
};
const notificationPreferenceRepositoryMock = { removeFamily: jest.fn() };

// endregion Mocks

let setup: RemoveFamilyNotificationsUseCase;

beforeEach(async () => {
  jest.clearAllMocks();

  const module = await Test.createTestingModule({
    providers: [
      RemoveFamilyNotificationsUseCase,
      { provide: 'INotificationRepository', useValue: notificationRepositoryMock },
      {
        provide: 'INotificationPreferenceRepository',
        useValue: notificationPreferenceRepositoryMock,
      },
    ],
  }).compile();

  setup = module.get(RemoveFamilyNotificationsUseCase);
});

const mocks = {
  notificationPreferenceRepository: notificationPreferenceRepositoryMock,
  notificationRepository: notificationRepositoryMock,
};

export { mocks, setup };
