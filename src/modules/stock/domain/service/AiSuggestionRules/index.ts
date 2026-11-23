import { StockUnits } from '@stock/domain/entity/StockEntity';

export interface AiFields {
  brand?: string;
  categoryId?: string;
  description?: string;
  locationId?: string;
  openedShelfLifeDays?: number;
  packageQuantity?: number;
  unit?: StockUnits;
}
export interface AiRaw {
  brand?: string;
  categoryPath?: string;
  confidence?: 'HIGH' | 'LOW';
  description?: string;
  locationName?: string;
  openedShelfLifeDays?: number;
  packageQuantity?: number;
  unit?: StockUnits;
}
export interface CatalogChoice {
  id: string;
  path: string;
}
export interface LocationChoice {
  id: string;
  name: string;
}

const SHELF_LIFE_MIN = 1;
const SHELF_LIFE_MAX = 3650;
const DESCRIPTION_MAX = 100;
const BRAND_MAX = 100;

// Spec 121 FR 13: the AI only suggests; anything outside the owner's own paths/names or the bounds is dropped.
export function filterAiFields(
  raw: AiRaw,
  catalog: { categories: CatalogChoice[]; locations: LocationChoice[] },
): AiFields {
  const category = raw.categoryPath
    ? catalog.categories.find((choice) => choice.path === raw.categoryPath)
    : undefined;
  const location = raw.locationName
    ? catalog.locations.find((choice) => choice.name === raw.locationName)
    : undefined;
  const days = raw.openedShelfLifeDays;
  const description = raw.description?.trim().slice(0, DESCRIPTION_MAX);
  const brand = raw.brand?.trim().slice(0, BRAND_MAX);
  const quantity = raw.packageQuantity;

  return {
    ...(brand ? { brand } : {}),
    ...(category ? { categoryId: category.id } : {}),
    ...(description ? { description } : {}),
    ...(location ? { locationId: location.id } : {}),
    ...(days !== undefined &&
    Number.isInteger(days) &&
    days >= SHELF_LIFE_MIN &&
    days <= SHELF_LIFE_MAX
      ? { openedShelfLifeDays: days }
      : {}),
    ...(quantity !== undefined && quantity > 0
      ? { packageQuantity: Math.round(quantity * 1000) / 1000 }
      : {}),
    ...(raw.unit ? { unit: raw.unit } : {}),
  };
}
