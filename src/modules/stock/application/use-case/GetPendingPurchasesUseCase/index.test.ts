import { mocks, setup, userId } from './index.mocks';

const now = new Date('2026-11-18T12:00:00.000Z');

it('SHOULD discard the empty purchases idle for 24 h before listing the pending ones', async () => {
  mocks.purchases.findPending.mockResolvedValue([{ id: 'p' }]);

  const result = await setup.execute({ accessibleOwners: mocks.accessibleOwners, now, userId });

  expect(result).toEqual([{ id: 'p' }]);
  expect(mocks.purchases.discardIdle).toHaveBeenCalledWith(
    mocks.accessibleOwners,
    new Date('2026-11-17T12:00:00.000Z'),
  );
  expect(mocks.purchases.findPending).toHaveBeenCalledWith(mocks.accessibleOwners, now);
});

it('SHOULD leave archived families out', async () => {
  await setup.execute({ accessibleOwners: mocks.archivedOwners, now, userId });

  expect(mocks.purchases.findPending).toHaveBeenCalledWith(
    [{ owner: 'USER', ownerId: 'user-id' }],
    now,
  );
});
