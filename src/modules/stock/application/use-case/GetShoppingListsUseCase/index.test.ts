import { ShoppingListRowOrigins } from '@stock/domain/entity/ShoppingListRowEntity';

import { mocks, setup, shoppingList, shoppingRow } from './index.mocks';

it('SHOULD ensure the default of every writable owner AND return the cards with counts and estimate', async () => {
  const list = shoppingList('d', { isDefault: true });

  mocks.lists.findByOwners.mockResolvedValue([list]);
  mocks.lists.findRowsByLists.mockResolvedValue([
    shoppingRow('r1', list, { origin: ShoppingListRowOrigins.MANUAL, price: 150, quantity: 2 }),
    shoppingRow('r2', list, { description: 'Soap' }),
  ]);

  const cards = await setup.execute({
    accessibleOwners: mocks.accessibleOwners,
    language: 'en-US',
  });

  expect(mocks.lists.ensureDefault).toHaveBeenCalledTimes(2);
  expect(mocks.lists.ensureDefault).toHaveBeenCalledWith(mocks.accessibleOwners[0], 'Groceries');
  expect(cards).toEqual([
    {
      autoCount: 0,
      estimatedTotalCents: 300,
      forecastCount: 0,
      list,
      pricedCount: 1,
      rowCount: 2,
      schedule: { nextTripDate: expect.any(Date), suggestedIntervalDays: null },
    },
  ]);
});

it('SHOULD skip archived families in "Todas" AND never create their default', async () => {
  await setup.execute({ accessibleOwners: mocks.archivedOwners });

  expect(mocks.lists.ensureDefault).toHaveBeenCalledTimes(1);
  expect(mocks.lists.findByOwners).toHaveBeenCalledWith([mocks.archivedOwners[0]], false);
});

it('SHOULD narrow to the owner id AND still reach an archived family explicitly, read-only', async () => {
  await setup.execute({
    accessibleOwners: mocks.archivedOwners,
    includeArchived: true,
    ownerId: 'family-id',
  });

  expect(mocks.lists.ensureDefault).not.toHaveBeenCalled();
  expect(mocks.lists.findByOwners).toHaveBeenCalledWith([mocks.archivedOwners[1]], true);
});

it('SHOULD refresh the stale forecasts before reading the lists and rows (spec 123 FR 14)', async () => {
  await setup.execute({ accessibleOwners: mocks.accessibleOwners });

  expect(mocks.refresh.execute).toHaveBeenCalledTimes(1);
  expect(mocks.refresh.execute.mock.invocationCallOrder[0]).toBeLessThan(
    mocks.lists.findByOwners.mock.invocationCallOrder[0],
  );
});
