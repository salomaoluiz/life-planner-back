import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import { ValidationError } from '@shared/domain/error/ValidationError';
import { item, lot } from '@stock/application/mocks/stock.mocks';

import { mocks, setup } from './index.mocks';

const now = new Date('2026-11-18T12:00:00.000Z');

it('SHOULD rank over the last 30 days among writable owners and keep the repository order', async () => {
  mocks.stock.findFrequentItemIds.mockResolvedValue(['b', 'a']);
  mocks.stock.findByIds.mockResolvedValue([
    item([lot('l1', 1)], (f) => f.withId('b')),
    item([lot('l2', 2)], (f) => f.withId('a')),
  ]);

  const result = await setup.execute({
    accessibleOwners: [
      ...mocks.accessibleOwners,
      { archived: true, owner: OwnerType.FAMILY, ownerId: 'archived-family' },
    ],
    limit: 5,
    now,
  });

  expect(mocks.stock.findFrequentItemIds).toHaveBeenCalledWith(
    mocks.accessibleOwners,
    new Date('2026-10-19T12:00:00.000Z'),
    5,
  );
  expect(result.map((view) => view.item.id)).toEqual(['b', 'a']);
});

it('SHOULD default the limit to 5, return [] without reading items and refuse limits outside 1-10', async () => {
  mocks.stock.findFrequentItemIds.mockResolvedValue([]);
  expect(await setup.execute({ accessibleOwners: mocks.accessibleOwners, now })).toEqual([]);
  expect(mocks.stock.findFrequentItemIds).toHaveBeenCalledWith(
    mocks.accessibleOwners,
    expect.any(Date),
    5,
  );
  expect(mocks.stock.findByIds).not.toHaveBeenCalled();
  expect(async () => setup.execute({ accessibleOwners: [], limit: 11 })).rejects.toThrow(
    ValidationError,
  );
});
