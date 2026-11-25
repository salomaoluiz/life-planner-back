import { ValidationError } from '@shared/domain/error/ValidationError';
import { category, day, item, lot } from '@stock/application/mocks/stock.mocks';

import { mocks, setup } from './index.mocks';

it('SHOULD query every accessible owner in one repository call AND read the catalogs of all owners at once', async () => {
  await setup.execute({ accessibleOwners: mocks.accessibleOwners });

  expect(mocks.stock.findByOwners).toHaveBeenCalledTimes(1);
  expect(mocks.stock.findByOwners).toHaveBeenCalledWith(mocks.accessibleOwners, {
    categoryIds: undefined,
    locationIds: undefined,
  });
  expect(mocks.catalog.findCatalogByOwners).toHaveBeenCalledTimes(1);
  expect(mocks.catalog.findCatalogByOwners).toHaveBeenCalledWith(mocks.accessibleOwners);
});

it('SHOULD sort by nearest expiration (nulls last), then description case-insensitive, then id', async () => {
  function withLot(description: string, id: string, expiration?: string) {
    return item([lot(`l-${id}`, 1, expiration ? { expirationDate: day(expiration) } : {})], (f) =>
      f.withDescription(description).withId(id),
    );
  }

  mocks.stock.findByOwners.mockResolvedValueOnce([
    withLot('banana', 'b'),
    withLot('zucchini', 'c', '2027-01-01'),
    withLot('same', 'y'),
    withLot('Apple', 'z'),
    withLot('Beta', 'd', '2026-10-20'),
    withLot('SAME', 'x'),
    withLot('alpha', 'e', '2026-10-20'),
  ]);

  const result = await setup.execute({ accessibleOwners: mocks.accessibleOwners });

  expect(result.map((view) => view.item.id)).toEqual(['e', 'd', 'c', 'z', 'b', 'x', 'y']);
});

it('SHOULD expand a category filter to its descendants and keep unknown ids', async () => {
  mocks.catalog.findCatalogByOwners.mockResolvedValue({
    categories: [category('dairy'), category('cheese', { parentId: 'dairy' })],
    locations: [],
    shoppingLists: [],
  });

  await setup.execute({
    accessibleOwners: mocks.accessibleOwners,
    categoryIds: ['dairy', 'ghost'],
    locationIds: ['fridge'],
  });

  expect(mocks.stock.findByOwners).toHaveBeenCalledWith(mocks.accessibleOwners, {
    categoryIds: ['dairy', 'cheese', 'ghost'],
    locationIds: ['fridge'],
  });
});

it('SHOULD narrow to one owner WHEN ownerId is given', async () => {
  await setup.execute({ accessibleOwners: mocks.accessibleOwners, ownerId: mocks.familyId });

  expect(mocks.stock.findByOwners.mock.calls[0][0]).toEqual([mocks.accessibleOwners[1]]);
});

it('SHOULD return [] WITHOUT touching the repository WHEN the ownerId is not accessible', async () => {
  expect(await setup.execute({ accessibleOwners: mocks.accessibleOwners, ownerId: 'x' })).toEqual(
    [],
  );
  expect(mocks.stock.findByOwners).not.toHaveBeenCalled();
});

it('SHOULD throw ValidationError WHEN the input is malformed', async () => {
  await expect(setup.execute({ accessibleOwners: 'nope' } as never)).rejects.toThrow(
    ValidationError,
  );
});

it('SHOULD refresh the stale forecasts of the owners before reading (spec 123 FR 14)', async () => {
  await setup.execute({ accessibleOwners: mocks.accessibleOwners, today: '2026-11-25' });

  expect(mocks.refresh.execute).toHaveBeenCalledTimes(1);
  expect(mocks.refresh.execute).toHaveBeenCalledWith({
    owners: expect.any(Array),
    today: new Date('2026-11-25T00:00:00.000Z'),
  });
  expect(mocks.refresh.execute.mock.invocationCallOrder[0]).toBeLessThan(
    mocks.stock.findByOwners.mock.invocationCallOrder[0],
  );
});
