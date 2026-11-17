import { BadRequestException, NotFoundException } from '@nestjs/common';

import { item } from '@stock/application/mocks/stock.mocks';
import { decodeMovementCursor, encodeMovementCursor } from '@stock/domain/service/MovementCursor';

import { mocks, movement, setup } from './index.mocks';

const input = { accessibleOwners: mocks.accessibleOwners, itemId: 'item' };

it('SHOULD return the page WITHOUT a cursor WHEN there is no next page', async () => {
  mocks.stock.findMovements.mockResolvedValue([movement('a'), movement('b')]);

  const page = await setup.execute(input);

  expect(page.items).toHaveLength(2);
  expect(page.nextCursor).toBeNull();
  expect(page.owner).toEqual({ owner: 'USER', ownerId: 'user-id' });
  expect(mocks.stock.findMovements).toHaveBeenCalledWith('item', 31, undefined);
});

it('SHOULD return 30 items and a cursor to the last one WHEN a 31st row exists', async () => {
  const rows = Array.from({ length: 31 }, (_, index) => movement(`m${index}`));

  mocks.stock.findMovements.mockResolvedValue(rows);

  const page = await setup.execute(input);

  expect(page.items).toHaveLength(30);
  expect(decodeMovementCursor(page.nextCursor as string)).toEqual({
    createdAt: rows[29].createdAt,
    id: 'm29',
  });
});

it('SHOULD continue from the cursor AND refuse one this API did not produce (400)', async () => {
  const cursor = encodeMovementCursor({ createdAt: new Date('2026-11-09T00:00:00.000Z'), id: 'x' });

  await setup.execute({ ...input, cursor });
  expect(mocks.stock.findMovements).toHaveBeenCalledWith('item', 31, {
    createdAt: new Date('2026-11-09T00:00:00.000Z'),
    id: 'x',
  });

  await expect(setup.execute({ ...input, cursor: 'garbage' })).rejects.toThrow(BadRequestException);
});

it.each([
  ['missing', undefined],
  ['of another owner', item([], (f) => f.withOwnerId('other'))],
])('SHOULD answer 404 WHEN the item is %s', async (_label, found) => {
  mocks.stock.findById.mockResolvedValue(found);

  await expect(setup.execute(input)).rejects.toThrow(NotFoundException);
});
