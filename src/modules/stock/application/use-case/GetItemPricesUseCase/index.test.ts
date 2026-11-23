import { NotFoundException } from '@nestjs/common';

import { mocks, setup } from './index.mocks';

function point(id: string) {
  return {
    date: new Date('2026-11-01T00:00:00.000Z'),
    id,
    marketId: 'm',
    unitPriceCents: 100,
  };
}

it('SHOULD cut the page AND hand the cursor of the last point WHEN there is more', async () => {
  mocks.purchases.findPriceHistory.mockResolvedValue([point('a'), point('b'), point('c')]);

  const result = await setup.execute({
    accessibleOwners: mocks.accessibleOwners,
    itemId: 'item',
    limit: 2,
    marketId: 'm',
  });

  expect(result.items.map((entry) => entry.id)).toEqual(['a', 'b']);
  expect(result.nextCursor).toEqual({ date: point('b').date, id: 'b' });
  expect(mocks.purchases.findPriceHistory).toHaveBeenCalledWith('item', 3, 'm', undefined);
});

it('SHOULD have no cursor on the last page', async () => {
  mocks.purchases.findPriceHistory.mockResolvedValue([point('a')]);

  const result = await setup.execute({ accessibleOwners: mocks.accessibleOwners, itemId: 'item' });

  expect(result.nextCursor).toBeUndefined();
});

it('SHOULD answer 404 for an item the caller cannot read', async () => {
  mocks.stock.findById.mockResolvedValue(undefined);
  await expect(
    setup.execute({ accessibleOwners: mocks.accessibleOwners, itemId: 'item' }),
  ).rejects.toThrow(NotFoundException);

  mocks.stock.findById.mockResolvedValue({ ...mocks.stock, owner: 'USER', ownerId: 'x' });
  await expect(
    setup.execute({ accessibleOwners: mocks.accessibleOwners, itemId: 'item' }),
  ).rejects.toThrow(NotFoundException);
});
