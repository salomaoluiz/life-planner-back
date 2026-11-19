import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import { shoppingList } from '@stock/application/mocks/stock.mocks';
import StockCategoryEntity, { StockCatalogStatus } from '@stock/domain/entity/StockCategoryEntity';
import StockLocationEntity from '@stock/domain/entity/StockLocationEntity';

import { planOwnerChange } from './index';

const date = new Date('2026-01-01T00:00:00.000Z');
function category(id: string, name: string, extra: Partial<StockCategoryEntity> = {}) {
  return new StockCategoryEntity({
    createdAt: date,
    id,
    name,
    owner: OwnerType.USER,
    ownerId: 'u',
    status: StockCatalogStatus.ACTIVE,
    updatedAt: date,
    ...extra,
  });
}
function location(id: string, name: string, status = StockCatalogStatus.ACTIVE) {
  return new StockLocationEntity({
    createdAt: date,
    id,
    name,
    owner: OwnerType.USER,
    ownerId: 'u',
    status,
    updatedAt: date,
  });
}

const source = {
  categories: [
    category('s-dairy', 'Dairy'),
    category('s-cheese', 'Cheese', { parentId: 's-dairy' }),
  ],
  locations: [location('s-fridge', 'Fridge')],
  shoppingLists: [],
};

it('SHOULD keep the same-name category (full path, case-insensitive) and location', () => {
  const target = {
    categories: [
      category('t-dairy', 'dairy'),
      category('t-cheese', 'CHEESE', { parentId: 't-dairy' }),
    ],
    locations: [location('t-fridge', 'fridge')],
    shoppingLists: [],
  };

  expect(
    planOwnerChange({ categoryId: 's-cheese', locationId: 's-fridge' }, source, target),
  ).toEqual({
    categoryId: 't-cheese',
    locationId: 't-fridge',
    preview: {
      category: { from: 'Dairy / Cheese', to: 'dairy / CHEESE' },
      location: { from: 'Fridge', to: 'fridge' },
      shoppingList: { from: null, to: null },
    },
    shoppingListId: null,
  });
});

it('SHOULD clear them WHEN the new owner has no match, only the leaf name matches or the match is archived', () => {
  const target = {
    categories: [
      category('t-cheese', 'Cheese'),
      category('t-dairy', 'Dairy', { status: StockCatalogStatus.ARCHIVED }),
    ],
    locations: [location('t-fridge', 'Fridge', StockCatalogStatus.ARCHIVED)],
    shoppingLists: [],
  };

  expect(
    planOwnerChange({ categoryId: 's-cheese', locationId: 's-fridge' }, source, target),
  ).toMatchObject({
    categoryId: null,
    locationId: null,
    preview: { category: { to: null }, location: { to: null } },
  });
});

it('SHOULD report nothing WHEN the item has no category or location', () => {
  expect(planOwnerChange({}, source, { categories: [], locations: [], shoppingLists: [] })).toEqual(
    {
      categoryId: null,
      locationId: null,
      preview: {
        category: { from: null, to: null },
        location: { from: null, to: null },
        shoppingList: { from: null, to: null },
      },
      shoppingListId: null,
    },
  );
});

it('SHOULD replace the shopping list by the active one with the same name in the new owner', () => {
  function lists(id: string, name: string, status = StockCatalogStatus.ACTIVE) {
    return shoppingList(id, { name, status });
  }
  const from = { categories: [], locations: [], shoppingLists: [lists('s-list', 'Pharmacy')] };

  expect(
    planOwnerChange({ shoppingListId: 's-list' }, from, {
      categories: [],
      locations: [],
      shoppingLists: [lists('t-list', 'pharmacy')],
    }),
  ).toMatchObject({
    preview: { shoppingList: { from: 'Pharmacy', to: 'pharmacy' } },
    shoppingListId: 't-list',
  });
  expect(
    planOwnerChange({ shoppingListId: 's-list' }, from, {
      categories: [],
      locations: [],
      shoppingLists: [lists('t-list', 'Pharmacy', StockCatalogStatus.ARCHIVED)],
    }),
  ).toMatchObject({
    preview: { shoppingList: { from: 'Pharmacy', to: null } },
    shoppingListId: null,
  });
});
