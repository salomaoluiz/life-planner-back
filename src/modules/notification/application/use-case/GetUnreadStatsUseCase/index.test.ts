import { mocks, setup } from './index.mocks';

it('SHOULD read the stats of the user with one repository call', async () => {
  const stats = { count: 3, lastCreatedAt: new Date(), lastReadAt: null };
  mocks.notificationRepository.getUnreadStats.mockResolvedValue(stats);

  expect(await setup.execute({ userId: 'user-1' })).toBe(stats);
  expect(mocks.notificationRepository.getUnreadStats).toHaveBeenCalledWith('user-1');
});
