import { NotFoundException } from '@nestjs/common';

import { mocks, setup } from './index.mocks';

it('SHOULD mark the notice of the user read', async () => {
  const now = new Date('2026-11-23T12:00:00Z');

  await setup.execute({ id: 'n-1', now, userId: 'user-1' });

  expect(mocks.notificationRepository.markRead).toHaveBeenCalledWith('user-1', 'n-1', now);
});

it("SHOULD answer 404 WHEN the notice is not the user's", async () => {
  mocks.notificationRepository.markRead.mockResolvedValue(false);

  await expect(setup.execute({ id: 'other', userId: 'user-1' })).rejects.toBeInstanceOf(
    NotFoundException,
  );
});
