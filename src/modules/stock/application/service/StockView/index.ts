import { OwnerAccess } from '@stock/domain/entity/OwnerAccess';
import ShoppingListEntity from '@stock/domain/entity/ShoppingListEntity';
import StockCategoryEntity from '@stock/domain/entity/StockCategoryEntity';
import StockEntity from '@stock/domain/entity/StockEntity';
import StockLocationEntity from '@stock/domain/entity/StockLocationEntity';
import StockLotEntity from '@stock/domain/entity/StockLotEntity';
import { IStockCatalogRepository } from '@stock/domain/repository';
import { pathOf } from '@stock/domain/service/CategoryTree';
import { leftoverFor, pickLeftover } from '@stock/domain/service/ConsumptionForecast';
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
import { todayUtc } from '@stock/domain/service/Today';
import { WasteSummary } from '@stock/domain/service/WasteSummary';

export interface CatalogLookup {
  categories: StockCategoryEntity[];
  locations: StockLocationEntity[];
  // Active lists only (spec 118).
  shoppingLists: ShoppingListEntity[];
}
// Spec 123 FR 8: the stored forecast as the API shows it (`weeklyRate` = daily rate x 7).
export interface ForecastView {
  computedOn?: Date;
  dailyRate: number;
  emptyDate?: Date;
  minDate?: Date;
  status: 'INSUFFICIENT_DATA' | 'NO_CONSUMPTION' | 'OK';
  weeklyRate: number;
}
export interface StockItemView {
  // Spec 123 FR 32: only on the detail; null when nothing was discarded in the last 90 days.
  waste90d?: null | WasteSummary;
  // Spec 118 FR 6: the item's list when it is active, else the owner's default list (when it exists).
  effectiveShoppingListId?: string;
  expirationStatus: LotStatus;
  forecast?: ForecastView;
  // The FORECAST row of the item (spec 123 FR 19): which list shows it and with what quantity.
  forecastRow?: { listId: string; listName?: string; quantity: number };
  hasForecastRow: boolean;
  // Spec 117 FR 15: any lot (with stock) whose effective expiration is before today.
  hasExpiredLot: boolean;
  hasOpenLot: boolean;
  item: StockEntity;
  // Spec 123 FR 23: the worst lot that will expire before it is used (not dismissed).
  leftover?: { date: Date; lotId: string; quantity: number };
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
  // Spec 123 FR 25: the warning of this lot was dismissed and has not come back.
  leftoverDismissed: boolean;
  leftoverQuantity?: number;
  lot: StockLotEntity;
}

export function toStockItemView(
  item: StockEntity,
  today: Date,
  catalog: CatalogLookup,
): StockItemView {
  const lots = item.lots.filter((lot) => lot.quantity > 0);
  const quantity = fromMilli(lots.reduce((sum, lot) => sum + toMilli(lot.quantity), 0));
  const leftovers =
    item.forecast?.status === 'OK' && item.forecast.dailyRate
      ? leftoverFor({
          lots: lots.map((lot) => ({
            effectiveExpiration: effectiveExpiration(lot, item.openedShelfLifeDays),
            id: lot.id,
            openedAt: lot.openedAt,
            quantity: lot.quantity,
          })),
          rate: item.forecast.dailyRate,
          today,
          unit: item.unit,
        })
      : [];
  const dismissed = new Map(
    lots
      .filter((lot) => lot.leftoverDismissedAt && lot.leftoverDismissedQuantity !== undefined)
      .map((lot) => [lot.id, lot.leftoverDismissedQuantity as number]),
  );
  const visible = new Set(
    leftovers
      .filter((entry) => pickLeftover([entry], dismissed, item.unit))
      .map((entry) => entry.lotId),
  );
  const lotViews = lots
    .map((lot) => {
      const leftover = leftovers.find((entry) => entry.lotId === lot.id);

      return {
        effectiveExpiration: effectiveExpiration(lot, item.openedShelfLifeDays),
        expirationStatus: lotStatus(lot, item, today),
        leftoverDismissed: leftover !== undefined && !visible.has(lot.id),
        leftoverQuantity: leftover?.quantity,
        lot,
      };
    })
    .sort(compareLots);
  const category = catalog.categories.find((row) => row.id === item.categoryId);
  const location = catalog.locations.find((row) => row.id === item.locationId);

  const pointed = catalog.shoppingLists.find((row) => row.id === item.shoppingListId);
  const effectiveList =
    pointed ??
    catalog.shoppingLists.find(
      (row) => row.isDefault && row.owner === item.owner && row.ownerId === item.ownerId,
    );

  return {
    category: category && {
      archived: category.status === 'ARCHIVED',
      id: category.id,
      name: category.name,
      path: pathOf(catalog.categories, category.id),
    },
    effectiveShoppingListId: effectiveList?.id,
    expirationStatus: worstStatus(lotViews.map((view) => view.expirationStatus)),
    forecast: forecastViewOf(item),
    forecastRow: item.forecastRow && {
      listId: item.forecastRow.listId,
      listName: catalog.shoppingLists.find((row) => row.id === item.forecastRow?.listId)?.name,
      quantity: item.forecastRow.quantity,
    },
    hasExpiredLot: lotViews.some((view) => view.expirationStatus === 'EXPIRED'),
    hasForecastRow: item.forecastRow !== undefined,
    hasOpenLot: lots.some((lot) => lot.openedAt),
    item,
    leftover:
      item.forecast?.leftoverLotId &&
      item.forecast.leftoverQuantity !== undefined &&
      item.forecast.leftoverDate
        ? {
            date: item.forecast.leftoverDate,
            lotId: item.forecast.leftoverLotId,
            quantity: item.forecast.leftoverQuantity,
          }
        : undefined,
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

// Spec 116 FR 5, 6, 19, 20 and 34: everything the list and the detail show, derived from the lots.
export { todayUtc };
function compareLots(a: StockLotView, b: StockLotView): number {
  if (Boolean(a.lot.openedAt) !== Boolean(b.lot.openedAt)) {
    return a.lot.openedAt ? -1 : 1;
  }

  return (
    compareNullsLast(a.effectiveExpiration?.getTime(), b.effectiveExpiration?.getTime()) ||
    a.lot.id.localeCompare(b.lot.id)
  );
}
function forecastViewOf(item: StockEntity): ForecastView | undefined {
  const forecast = item.forecast;

  return forecast
    ? {
        computedOn: forecast.computedOn,
        dailyRate: forecast.dailyRate ?? 0,
        emptyDate: forecast.emptyDate,
        minDate: forecast.minDate,
        status: forecast.status,
        weeklyRate: fromMilli(toMilli(forecast.dailyRate ?? 0) * 7),
      }
    : undefined;
}

// The categories and locations of every owner the views refer to (two statements whatever the owners).
export async function loadCatalogLookup(
  catalog: IStockCatalogRepository,
  owners: OwnerAccess[],
): Promise<CatalogLookup> {
  return catalog.findCatalogByOwners(owners);
}
