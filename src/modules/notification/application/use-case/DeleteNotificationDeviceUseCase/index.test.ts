import { NotFoundException } from '@nestjs/common';

import { mocks, setup } from './index.mocks';

it("SHOULD delete the user's device", async () => {
  await setup.execute({ id: 'd-1', userId: 'user-1' });

  expect(mocks.notificationDeviceRepository.delete).toHaveBeenCalledWith('d-1');
});

it("SHOULD answer 404 WITHOUT deleting WHEN the device is another user's", async () => {
  await expect(setup.execute({ id: 'd-1', userId: 'someone-else' })).rejects.toBeInstanceOf(
    NotFoundException,
  );
  expect(mocks.notificationDeviceRepository.delete).not.toHaveBeenCalled();
});
