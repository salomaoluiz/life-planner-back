import StockCategoryEntity, { StockCatalogStatus } from '@stock/domain/entity/StockCategoryEntity';
import StockLocationEntity from '@stock/domain/entity/StockLocationEntity';
import { pathOf } from '@stock/domain/service/CategoryTree';

export interface OwnerChangePlan {
  categoryId: null | string;
  locationId: null | string;
  preview: { category: OwnerChangeSide; location: OwnerChangeSide };
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
  item: { categoryId?: string; locationId?: string },
  source: { categories: StockCategoryEntity[]; locations: StockLocationEntity[] },
  target: { categories: StockCategoryEntity[]; locations: StockLocationEntity[] },
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

  return {
    categoryId: toCategory?.id ?? null,
    locationId: toLocation?.id ?? null,
    preview: {
      category: {
        from: fromCategory,
        to: toCategory ? pathOf(target.categories, toCategory.id) : null,
      },
      location: { from: fromLocation, to: toLocation?.name ?? null },
    },
  };
}
