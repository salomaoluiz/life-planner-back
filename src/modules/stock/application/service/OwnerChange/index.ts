import ShoppingListEntity from '@stock/domain/entity/ShoppingListEntity';
import StockCategoryEntity, { StockCatalogStatus } from '@stock/domain/entity/StockCategoryEntity';
import StockLocationEntity from '@stock/domain/entity/StockLocationEntity';
import { pathOf } from '@stock/domain/service/CategoryTree';

export interface OwnerChangePlan {
  categoryId: null | string;
  locationId: null | string;
  preview: { category: OwnerChangeSide; location: OwnerChangeSide; shoppingList: OwnerChangeSide };
  shoppingListId: null | string;
}
export interface OwnerChangeSide {
  from: null | string;
  to: null | string;
}

function same(a: string, b: string) {
  return a.toLowerCase() === b.toLowerCase();
}

// Spec 116 FR 27: the category (by full path) and the location (by name) are replaced by the ACTIVE row with the
// same name (case-insensitive) in the new owner, or cleared.
export function planOwnerChange(
  item: { categoryId?: string; locationId?: string; shoppingListId?: string },
  source: {
    categories: StockCategoryEntity[];
    locations: StockLocationEntity[];
    shoppingLists: ShoppingListEntity[];
  },
  target: {
    categories: StockCategoryEntity[];
    locations: StockLocationEntity[];
    shoppingLists: ShoppingListEntity[];
  },
): OwnerChangePlan {
  const fromCategory = item.categoryId ? pathOf(source.categories, item.categoryId) : null;
  const fromLocation = source.locations.find((row) => row.id === item.locationId)?.name ?? null;
  const toCategory = fromCategory
    ? target.categories.find(
        (row) =>
          row.status === StockCatalogStatus.ACTIVE &&
          same(pathOf(target.categories, row.id), fromCategory),
      )
    : undefined;
  const toLocation = fromLocation
    ? target.locations.find(
        (row) => row.status === StockCatalogStatus.ACTIVE && same(row.name, fromLocation),
      )
    : undefined;

  // Spec 118 FR 8: the list is replaced by the active list with the same name in the new owner.
  const fromList = source.shoppingLists.find((row) => row.id === item.shoppingListId)?.name ?? null;
  const toList = fromList
    ? target.shoppingLists.find(
        (row) => row.status === StockCatalogStatus.ACTIVE && same(row.name, fromList),
      )
    : undefined;

  return {
    categoryId: toCategory?.id ?? null,
    locationId: toLocation?.id ?? null,
    preview: {
      category: {
        from: fromCategory,
        to: toCategory ? pathOf(target.categories, toCategory.id) : null,
      },
      location: { from: fromLocation, to: toLocation?.name ?? null },
      shoppingList: { from: fromList, to: toList?.name ?? null },
    },
    shoppingListId: toList?.id ?? null,
  };
}
