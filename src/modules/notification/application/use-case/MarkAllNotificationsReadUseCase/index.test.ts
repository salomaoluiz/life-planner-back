import { mocks, setup } from './index.mocks';

it('SHOULD mark everything up to now WHEN no moment is given', async () => {
  const now = new Date('2026-11-23T12:00:00Z');

  await setup.execute({ now, userId: 'user-1' });

  expect(mocks.notificationRepository.markAllRead).toHaveBeenCalledWith('user-1', now, now);
});

it('SHOULD mark only up to the given moment', async () => {
  const before = new Date('2026-11-20T00:00:00Z');
  const now = new Date('2026-11-23T12:00:00Z');

  await setup.execute({ before, now, userId: 'user-1' });

  expect(mocks.notificationRepository.markAllRead).toHaveBeenCalledWith('user-1', before, now);
});
