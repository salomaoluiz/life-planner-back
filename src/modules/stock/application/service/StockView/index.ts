import { OwnerAccess } from '@stock/domain/entity/OwnerAccess';
import StockCategoryEntity from '@stock/domain/entity/StockCategoryEntity';
import StockEntity from '@stock/domain/entity/StockEntity';
import StockLocationEntity from '@stock/domain/entity/StockLocationEntity';
import StockLotEntity from '@stock/domain/entity/StockLotEntity';
import { IStockCatalogRepository } from '@stock/domain/repository';
import { pathOf } from '@stock/domain/service/CategoryTree';
import {
  effectiveExpiration,
  lotStatus,
  LotStatus,
  nearestExpiration,
  worstStatus,
} from '@stock/domain/service/LotExpiration';
import { compareNullsLast } from '@stock/domain/service/NullsLast';
import { fromMilli, toMilli } from '@stock/domain/service/StockQuantity';
import { needsRestock, restockQuantity } from '@stock/domain/service/StockRestock';

export interface CatalogLookup {
  categories: StockCategoryEntity[];
  locations: StockLocationEntity[];
}
export interface StockItemView {
  expirationStatus: LotStatus;
  hasOpenLot: boolean;
  item: StockEntity;
  // Open lots first, then by effective expiration (nulls last).
  category?: { archived: boolean; id: string; name: string; path: string };
  location?: { archived: boolean; id: string; name: string };
  lots: StockLotView[];
  nearestExpiration?: Date;
  needsRestock: boolean;
  quantity: number;
  restockQuantity: number;
}
export interface StockLotView {
  effectiveExpiration?: Date;
  expirationStatus: LotStatus;
  lot: StockLotEntity;
}

function compareLots(a: StockLotView, b: StockLotView): number {
  if (Boolean(a.lot.openedAt) !== Boolean(b.lot.openedAt)) {
    return a.lot.openedAt ? -1 : 1;
  }

  return (
    compareNullsLast(a.effectiveExpiration?.getTime(), b.effectiveExpiration?.getTime()) ||
    a.lot.id.localeCompare(b.lot.id)
  );
}

// Spec 116 FR 5, 6, 19, 20 and 34: everything the list and the detail show, derived from the lots.
export function todayUtc(): Date {
  return new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
}
export function toStockItemView(
  item: StockEntity,
  today: Date,
  catalog: CatalogLookup,
): StockItemView {
  const lots = item.lots.filter((lot) => lot.quantity > 0);
  const quantity = fromMilli(lots.reduce((sum, lot) => sum + toMilli(lot.quantity), 0));
  const lotViews = lots
    .map((lot) => ({
      effectiveExpiration: effectiveExpiration(lot, item.openedShelfLifeDays),
      expirationStatus: lotStatus(lot, item, today),
      lot,
    }))
    .sort(compareLots);
  const category = catalog.categories.find((row) => row.id === item.categoryId);
  const location = catalog.locations.find((row) => row.id === item.locationId);

  return {
    category: category && {
      archived: category.status === 'ARCHIVED',
      id: category.id,
      name: category.name,
      path: pathOf(catalog.categories, category.id),
    },
    expirationStatus: worstStatus(lotViews.map((view) => view.expirationStatus)),
    hasOpenLot: lots.some((lot) => lot.openedAt),
    item,
    location: location && {
      archived: location.status === 'ARCHIVED',
      id: location.id,
      name: location.name,
    },
    lots: lotViews,
    nearestExpiration: nearestExpiration(lots, item.openedShelfLifeDays),
    needsRestock: needsRestock(item.stockOnly, quantity, item.minQuantity),
    quantity,
    restockQuantity: restockQuantity(quantity, item.idealQuantity),
  };
}

// The categories and locations of every owner the views refer to (two statements whatever the owners).
export async function loadCatalogLookup(
  catalog: IStockCatalogRepository,
  owners: OwnerAccess[],
): Promise<CatalogLookup> {
  return catalog.findCatalogByOwners(owners);
}
