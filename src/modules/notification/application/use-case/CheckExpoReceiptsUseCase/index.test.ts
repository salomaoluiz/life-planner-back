import { LogLevel } from '@shared/infra/logger/types';

import { mocks, setup } from './index.mocks';

const now = new Date('2026-11-23T12:00:00.000Z');
const tickets = [
  { deliveryId: 'del-1', deviceId: 'device-1', ticketId: 't-1' },
  { deliveryId: 'del-2', deviceId: 'device-2', ticketId: 't-2' },
  { deliveryId: 'del-3', deviceId: 'device-3', ticketId: 't-3' },
  { deliveryId: 'del-4', deviceId: 'device-4', ticketId: 't-4' },
];

it('SHOULD ask for tickets older than 15 minutes and younger than 24 hours AND do nothing WHEN there are none', async () => {
  expect(await setup.execute({ now })).toEqual({ checked: 0, devicesDeleted: 0 });

  expect(mocks.notificationRepository.findSentTickets).toHaveBeenCalledWith(
    new Date('2026-11-23T11:45:00.000Z'),
    new Date('2026-11-22T12:00:00.000Z'),
    1000,
  );
  expect(mocks.pushSender.getExpoReceipts).not.toHaveBeenCalled();
});

it('SHOULD delete the device on DeviceNotRegistered, LOG other errors by code only AND drop checked ticket ids', async () => {
  mocks.notificationRepository.findSentTickets.mockResolvedValue(tickets);
  mocks.pushSender.getExpoReceipts.mockResolvedValue({
    't-1': { status: 'ok' },
    't-2': { error: 'DeviceNotRegistered', status: 'error' },
    't-3': { error: 'MessageRateExceeded', status: 'error' },
  });

  expect(await setup.execute({ now })).toEqual({ checked: 3, devicesDeleted: 1 });

  expect(mocks.pushSender.getExpoReceipts).toHaveBeenCalledWith(['t-1', 't-2', 't-3', 't-4']);
  expect(mocks.notificationRepository.updateDeliveries).toHaveBeenCalledWith([
    { id: 'del-1', status: 'SENT', ticketId: null },
    { error: 'DeviceNotRegistered', id: 'del-2', status: 'INVALID', ticketId: null },
    { error: 'MessageRateExceeded', id: 'del-3', status: 'FAILED', ticketId: null },
  ]);
  expect(mocks.notificationDeviceRepository.deleteMany).toHaveBeenCalledWith(['device-2']);
  expect(mocks.logger.log).toHaveBeenCalledWith(LogLevel.WARN, 'Expo receipt error', {
    code: 'MessageRateExceeded',
    module: 'CheckExpoReceiptsUseCase',
  });
  expect(mocks.logger.log).toHaveBeenCalledTimes(1);
});

it('SHOULD name an error without a code Unknown', async () => {
  mocks.notificationRepository.findSentTickets.mockResolvedValue([tickets[0]]);
  mocks.pushSender.getExpoReceipts.mockResolvedValue({ 't-1': { status: 'error' } });

  await setup.execute();

  expect(mocks.notificationRepository.updateDeliveries).toHaveBeenCalledWith([
    expect.objectContaining({ error: 'Unknown' }),
  ]);
});
