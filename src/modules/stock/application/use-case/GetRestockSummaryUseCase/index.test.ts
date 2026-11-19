import { ShoppingListRowOrigins } from '@stock/domain/entity/ShoppingListRowEntity';

import { mocks, setup, shoppingList, shoppingRow } from './index.mocks';

const market = shoppingList('m', { isDefault: true, name: 'Mercado' });
const pharmacy = shoppingList('p', { name: 'Farmácia' });
const dollars = shoppingList('d', { currency: 'USD', name: 'Amazon' });

it('SHOULD list at most 5 rows (default list first, rows by description) AND count and total all of them per currency', async () => {
  const auto = ShoppingListRowOrigins.AUTO;

  mocks.lists.findRestockRows.mockResolvedValueOnce([
    shoppingRow('1', pharmacy, { description: 'Soap', origin: auto, price: 300 }),
    ...['E', 'D', 'C', 'B', 'A'].map((name, index) =>
      shoppingRow(`m${index}`, market, { description: name, origin: auto, price: 100 }),
    ),
    shoppingRow('x', dollars, { description: 'Cable', origin: auto, price: 2000 }),
  ]);

  const summary = await setup.execute({ accessibleOwners: mocks.accessibleOwners });

  expect(summary.count).toBe(7);
  expect(summary.groups.map((group) => group.list.id)).toEqual(['m']);
  expect(summary.groups[0].rows.map((row) => row.description)).toEqual(['A', 'B', 'C', 'D', 'E']);
  expect(summary.totals).toEqual([
    { currency: 'BRL', estimatedTotalCents: 800, pricedCount: 6 },
    { currency: 'USD', estimatedTotalCents: 2000, pricedCount: 1 },
  ]);
});

it('SHOULD return an empty summary and skip archived families', async () => {
  const summary = await setup.execute({ accessibleOwners: mocks.archivedOwners });

  expect(summary).toEqual({ count: 0, groups: [], totals: [] });
  expect(mocks.lists.findRestockRows).toHaveBeenCalledWith([mocks.archivedOwners[0]]);
});
