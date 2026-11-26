import { NotFoundException } from '@nestjs/common';

import { mocks, setup } from './index.mocks';

it("SHOULD update the name and the switch of the user's device", async () => {
  expect(
    await setup.execute({ enabled: false, id: 'd-1', name: 'Tablet', userId: 'user-1' }),
  ).toEqual({
    enabled: false,
    id: 'd-1',
  });
  expect(mocks.notificationDeviceRepository.update).toHaveBeenCalledWith('d-1', {
    enabled: false,
    name: 'Tablet',
  });
});

it('SHOULD answer 404 WHEN the device belongs to another user or does not exist', async () => {
  await expect(setup.execute({ id: 'd-1', userId: 'someone-else' })).rejects.toBeInstanceOf(
    NotFoundException,
  );
  mocks.notificationDeviceRepository.findById.mockResolvedValue(undefined);
  await expect(setup.execute({ id: 'gone', userId: 'user-1' })).rejects.toBeInstanceOf(
    NotFoundException,
  );
  expect(mocks.notificationDeviceRepository.update).not.toHaveBeenCalled();
});
