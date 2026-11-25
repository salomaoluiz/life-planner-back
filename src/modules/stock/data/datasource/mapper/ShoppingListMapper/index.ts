import { ShoppingListRowOrigin, StockShoppingList, StockShoppingListRow } from '@db/client';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import { ShoppingRowWithItem } from '@stock/data/repository/datasource/IShoppingListDatasource';
import ShoppingListEntity from '@stock/domain/entity/ShoppingListEntity';
import ShoppingListRowEntity, {
  ShoppingListRowOrigins,
} from '@stock/domain/entity/ShoppingListRowEntity';
import { StockCatalogStatus } from '@stock/domain/entity/StockCategoryEntity';
import { StockUnits } from '@stock/domain/entity/StockEntity';
import { ShoppingRowRecord } from '@stock/domain/repository';
import { fromMilli, toMilli } from '@stock/domain/service/StockQuantity';

// numeric(14,3) arrives as a Decimal: three decimals at most, safe as a number.
export class ShoppingListMapper {
  static toList(raw: StockShoppingList): ShoppingListEntity {
    return new ShoppingListEntity({
      createdAt: raw.created_at,
      currency: raw.currency,
      defaultFinanceCategoryId: raw.default_finance_category_id ?? undefined,
      defaultMarketId: raw.default_market_id ?? undefined,
      id: raw.id,
      isDefault: raw.is_default,
      name: raw.name,
      owner: OwnerType[raw.owner],
      ownerId: raw.owner_id,
      purchaseIntervalDays: raw.purchase_interval_days,
      status: StockCatalogStatus[raw.status],
      updatedAt: raw.updated_at,
    });
  }

  static toRecord(raw: ShoppingRowWithItem): ShoppingRowRecord {
    const item = raw.item;

    return {
      item: item
        ? {
            categoryId: item.category_id ?? undefined,
            description: item.description,
            estimatedUnitPriceCents: item.estimated_unit_price_cents ?? undefined,
            forecast: {
              dailyRate:
                item.forecast_status === 'OK' && item.forecast_daily_rate !== null
                  ? toNumber(item.forecast_daily_rate)
                  : undefined,
              minDate: (item.forecast_status === 'OK' ? item.forecast_min_date : null) ?? undefined,
              wasteRatio90d:
                item.forecast_waste_ratio_90d === null
                  ? undefined
                  : toNumber(item.forecast_waste_ratio_90d),
            },
            id: item.id,
            idealQuantity: item.ideal_quantity === null ? undefined : toNumber(item.ideal_quantity),
            minQuantity: item.min_quantity === null ? undefined : toNumber(item.min_quantity),
            owner: OwnerType[item.owner],
            ownerId: item.owner_id,
            quantity: fromMilli(
              item.lots.reduce((sum, lot) => sum + toMilli(toNumber(lot.quantity)), 0),
            ),
            unit: item.unit as StockUnits,
          }
        : undefined,
      list: ShoppingListMapper.toList(raw.list),
      row: ShoppingListMapper.toRow(raw),
    };
  }

  static toRow(raw: StockShoppingListRow): ShoppingListRowEntity {
    return new ShoppingListRowEntity({
      createdAt: raw.created_at,
      createdBy: raw.created_by ?? undefined,
      description: raw.description ?? undefined,
      estimatedUnitPriceCents: raw.estimated_unit_price_cents ?? undefined,
      id: raw.id,
      itemId: raw.item_id ?? undefined,
      listId: raw.list_id,
      origin: ShoppingListRowOrigins[raw.origin as ShoppingListRowOrigin],
      quantity: toNumber(raw.quantity),
      unit: (raw.unit as null | StockUnits) ?? undefined,
      updatedAt: raw.updated_at,
    });
  }
}

function toNumber(value: { toString(): string }): number {
  return Number(value.toString());
}
