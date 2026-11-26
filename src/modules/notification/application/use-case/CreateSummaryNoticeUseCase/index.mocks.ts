import { Test } from '@nestjs/testing';

import { CreateSummaryNoticeUseCase } from './index';

// region Mocks

const notificationRepositoryMock = { create: jest.fn() };
const notificationPreferenceRepositoryMock = { setLastSummaryOn: jest.fn() };

// endregion Mocks

let setup: CreateSummaryNoticeUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  notificationRepositoryMock.create.mockImplementation(async (notice: object) => ({
    id: 'n-1',
    ...notice,
  }));
  const module = await Test.createTestingModule({
    providers: [
      CreateSummaryNoticeUseCase,
      { provide: 'INotificationRepository', useValue: notificationRepositoryMock },
      {
        provide: 'INotificationPreferenceRepository',
        useValue: notificationPreferenceRepositoryMock,
      },
    ],
  }).compile();

  setup = module.get(CreateSummaryNoticeUseCase);
});

const mocks = {
  notificationPreferenceRepository: notificationPreferenceRepositoryMock,
  notificationRepository: notificationRepositoryMock,
};

export { mocks, setup };
