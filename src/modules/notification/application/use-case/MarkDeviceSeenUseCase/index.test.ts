import { NotFoundException } from '@nestjs/common';

import { ValidationError } from '@shared/domain/error/ValidationError';

import { mocks, setup } from './index.mocks';

const input = {
  id: 'd-1',
  locale: 'en-US',
  timeZone: 'America/New_York',
  userId: 'user-1',
} as const;

it('SHOULD touch the device AND copy its time zone and locale to the user', async () => {
  const now = new Date('2026-11-23T11:00:00Z');

  await setup.execute({ ...input, now });

  expect(mocks.notificationDeviceRepository.markSeen).toHaveBeenCalledWith('d-1', now);
  expect(mocks.notificationPreferenceRepository.save).toHaveBeenCalledWith('user-1', {
    locale: 'en-US',
    timeZone: 'America/New_York',
  });
});

it("SHOULD answer 404 WHEN the device is not the user's", async () => {
  await expect(setup.execute({ ...input, userId: 'someone-else' })).rejects.toBeInstanceOf(
    NotFoundException,
  );
  expect(mocks.notificationPreferenceRepository.save).not.toHaveBeenCalled();
});

it('SHOULD answer 400 WHEN the time zone is unknown', async () => {
  await expect(setup.execute({ ...input, timeZone: 'Mars/Base' })).rejects.toBeInstanceOf(
    ValidationError,
  );
});
