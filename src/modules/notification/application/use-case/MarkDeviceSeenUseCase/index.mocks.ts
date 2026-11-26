import { Test } from '@nestjs/testing';

import { MarkDeviceSeenUseCase } from './index';

// region Mocks

const notificationDeviceRepositoryMock = { findById: jest.fn(), markSeen: jest.fn() };
const notificationPreferenceRepositoryMock = { save: jest.fn() };

// endregion Mocks

let setup: MarkDeviceSeenUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  notificationDeviceRepositoryMock.findById.mockResolvedValue({ id: 'd-1', userId: 'user-1' });
  const module = await Test.createTestingModule({
    providers: [
      MarkDeviceSeenUseCase,
      { provide: 'INotificationDeviceRepository', useValue: notificationDeviceRepositoryMock },
      {
        provide: 'INotificationPreferenceRepository',
        useValue: notificationPreferenceRepositoryMock,
      },
    ],
  }).compile();

  setup = module.get(MarkDeviceSeenUseCase);
});

const mocks = {
  notificationDeviceRepository: notificationDeviceRepositoryMock,
  notificationPreferenceRepository: notificationPreferenceRepositoryMock,
};

export { mocks, setup };
