import { mocks, setup } from './index.mocks';

const now = new Date('2026-11-23T04:00:00.000Z');

it('SHOULD purge notices after 30 days, final deliveries after 7 AND devices unseen for 60', async () => {
  expect(await setup.execute({ now })).toEqual({ deliveries: 1, devices: 3, notices: 2 });

  expect(mocks.notificationRepository.cleanup).toHaveBeenCalledWith(
    new Date('2026-10-24T04:00:00.000Z'),
    new Date('2026-11-16T04:00:00.000Z'),
  );
  expect(mocks.notificationDeviceRepository.deleteStale).toHaveBeenCalledWith(
    new Date('2026-09-24T04:00:00.000Z'),
  );
});

it('SHOULD default to the current time', async () => {
  await setup.execute();

  expect(mocks.notificationDeviceRepository.deleteStale).toHaveBeenCalledTimes(1);
});
