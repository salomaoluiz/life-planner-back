import { NotFoundException } from '@nestjs/common';

import { mocks, purchase, setup } from './index.mocks';

const base = { accessibleOwners: mocks.accessibleOwners, listId: 'list-id' };

it('SHOULD discard the idle empty purchases (24 h) AND list the open ones with their views', async () => {
  const now = new Date('2026-11-18T12:00:00.000Z');
  const result = await setup.execute({ ...base, now });

  expect(mocks.purchases.discardIdle).toHaveBeenCalledWith(
    [{ owner: 'USER', ownerId: 'user-id' }],
    new Date('2026-11-17T12:00:00.000Z'),
  );
  expect(result.open?.map((view) => view.purchase.id)).toEqual(['p']);
});

it('SHOULD page the closed purchases by closedAt with a cursor WHEN there is more', async () => {
  const closedAt = new Date('2026-11-10T00:00:00.000Z');

  mocks.purchases.findClosedByList.mockResolvedValue([
    purchase('a', { closedAt }),
    purchase('b', { closedAt }),
    purchase('c', { closedAt }),
  ]);

  const result = await setup.execute({ ...base, closed: true, limit: 2 });

  expect(result.closed?.items).toHaveLength(2);
  expect(result.closed?.nextCursor).toEqual({ closedAt, id: 'b' });
  expect(mocks.purchases.discardIdle).not.toHaveBeenCalled();
});

it('SHOULD answer 404 for a list the caller cannot read', async () => {
  mocks.lists.findById.mockResolvedValue(undefined);

  await expect(setup.execute(base)).rejects.toThrow(NotFoundException);
});
