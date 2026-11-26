import { mocks, setup } from './index.mocks';

it('SHOULD list the devices of the user', async () => {
  mocks.notificationDeviceRepository.findByUser.mockResolvedValue([{ id: 'd-1' }]);

  expect(await setup.execute({ userId: 'user-1' })).toEqual([{ id: 'd-1' }]);
  expect(mocks.notificationDeviceRepository.findByUser).toHaveBeenCalledWith('user-1');
});
