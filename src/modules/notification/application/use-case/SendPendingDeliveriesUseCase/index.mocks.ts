import { Test } from '@nestjs/testing';

import { SendPendingDeliveriesUseCase } from './index';

// region Mocks

const notificationRepositoryMock = {
  findPendingDeliveries: jest.fn(),
  updateDeliveries: jest.fn(),
};
const notificationDeviceRepositoryMock = { deleteMany: jest.fn() };
const pushSenderMock = { sendExpo: jest.fn(), sendWeb: jest.fn() };

// endregion Mocks

let setup: SendPendingDeliveriesUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  notificationRepositoryMock.findPendingDeliveries.mockResolvedValue([]);
  pushSenderMock.sendExpo.mockImplementation(async (messages: unknown[]) =>
    messages.map((_m, index) => ({ id: `ticket-${index}`, status: 'ok' })),
  );
  pushSenderMock.sendWeb.mockResolvedValue({ ok: true });
  const module = await Test.createTestingModule({
    providers: [
      SendPendingDeliveriesUseCase,
      { provide: 'INotificationRepository', useValue: notificationRepositoryMock },
      { provide: 'INotificationDeviceRepository', useValue: notificationDeviceRepositoryMock },
      { provide: 'IPushSender', useValue: pushSenderMock },
    ],
  }).compile();

  setup = module.get(SendPendingDeliveriesUseCase);
});

const mocks = {
  notificationDeviceRepository: notificationDeviceRepositoryMock,
  notificationRepository: notificationRepositoryMock,
  pushSender: pushSenderMock,
};

export { mocks, setup };
