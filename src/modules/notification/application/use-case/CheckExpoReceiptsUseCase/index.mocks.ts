import { Test } from '@nestjs/testing';

import { CheckExpoReceiptsUseCase } from './index';

// region Mocks

const notificationRepositoryMock = { findSentTickets: jest.fn(), updateDeliveries: jest.fn() };
const notificationDeviceRepositoryMock = { deleteMany: jest.fn() };
const pushSenderMock = { getExpoReceipts: jest.fn() };
const loggerMock = { log: jest.fn() };

// endregion Mocks

let setup: CheckExpoReceiptsUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  notificationRepositoryMock.findSentTickets.mockResolvedValue([]);
  pushSenderMock.getExpoReceipts.mockResolvedValue({});
  const module = await Test.createTestingModule({
    providers: [
      CheckExpoReceiptsUseCase,
      { provide: 'INotificationRepository', useValue: notificationRepositoryMock },
      { provide: 'INotificationDeviceRepository', useValue: notificationDeviceRepositoryMock },
      { provide: 'IPushSender', useValue: pushSenderMock },
      { provide: 'ILogger', useValue: loggerMock },
    ],
  }).compile();

  setup = module.get(CheckExpoReceiptsUseCase);
});

const mocks = {
  logger: loggerMock,
  notificationDeviceRepository: notificationDeviceRepositoryMock,
  notificationRepository: notificationRepositoryMock,
  pushSender: pushSenderMock,
};

export { mocks, setup };
