import { StockCategory, StockItem, StockLocation, StockLot, StockMovement } from '@db/client';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import { StockItemWithLots } from '@stock/data/repository/datasource/IStockDatasource';
import StockCategoryEntity, { StockCatalogStatus } from '@stock/domain/entity/StockCategoryEntity';
import StockEntity, { StockUnits } from '@stock/domain/entity/StockEntity';
import StockLocationEntity from '@stock/domain/entity/StockLocationEntity';
import StockLotEntity from '@stock/domain/entity/StockLotEntity';
import StockMovementEntity, {
  DiscardValueSources,
  StockMovementReasons,
  StockMovementTypes,
} from '@stock/domain/entity/StockMovementEntity';

// numeric(14,3) arrives as a Decimal: always three decimals at most, safe as a number.
export class StockMapper {
  static toCategory(raw: StockCategory): StockCategoryEntity {
    return new StockCategoryEntity({
      createdAt: raw.created_at,
      financeCategoryId: raw.finance_category_id ?? undefined,
      id: raw.id,
      name: raw.name,
      owner: OwnerType[raw.owner],
      ownerId: raw.owner_id,
      parentId: raw.parent_id ?? undefined,
      status: StockCatalogStatus[raw.status],
      updatedAt: raw.updated_at,
    });
  }

  static toDomain(raw: StockItem | StockItemWithLots): StockEntity {
    const lots = 'lots' in raw ? raw.lots : [];

    return new StockEntity({
      barcode: raw.barcode ?? undefined,
      brand: raw.brand ?? undefined,
      categoryId: raw.category_id ?? undefined,
      createdAt: raw.created_at,
      description: raw.description,
      estimatedUnitPriceCents: raw.estimated_unit_price_cents ?? undefined,
      forecast: raw.forecast_status
        ? {
            computedOn: raw.forecast_computed_on ?? undefined,
            dailyRate:
              raw.forecast_daily_rate === null ? undefined : toNumber(raw.forecast_daily_rate),
            emptyDate: raw.forecast_empty_date ?? undefined,
            leftoverDate: raw.forecast_leftover_date ?? undefined,
            leftoverLotId: raw.forecast_leftover_lot_id ?? undefined,
            leftoverQuantity:
              raw.forecast_leftover_quantity === null
                ? undefined
                : toNumber(raw.forecast_leftover_quantity),
            minDate: raw.forecast_min_date ?? undefined,
            status: raw.forecast_status,
            wasteRatio90d:
              raw.forecast_waste_ratio_90d === null
                ? undefined
                : toNumber(raw.forecast_waste_ratio_90d),
          }
        : undefined,
      id: raw.id,
      idealQuantity: raw.ideal_quantity === null ? undefined : toNumber(raw.ideal_quantity),
      locationId: raw.location_id ?? undefined,
      lots: lots.map((lot) => StockMapper.toLot(lot)),
      minQuantity: raw.min_quantity === null ? undefined : toNumber(raw.min_quantity),
      notes: raw.notes ?? undefined,
      openedShelfLifeDays: raw.opened_shelf_life_days ?? undefined,
      owner: OwnerType[raw.owner],
      ownerId: raw.owner_id,
      quickStep: raw.quick_step === null ? undefined : toNumber(raw.quick_step),
      shoppingListId: raw.shopping_list_id ?? undefined,
      stockOnly: raw.stock_only,
      // Prisma's generated StockUnit already carries the lowercase wire values.
      unit: raw.unit as StockUnits,
      updatedAt: raw.updated_at,
      warnDaysClosed: raw.warn_days_closed,
      warnDaysOpened: raw.warn_days_opened,
    });
  }

  static toLocation(raw: StockLocation): StockLocationEntity {
    return new StockLocationEntity({
      createdAt: raw.created_at,
      id: raw.id,
      name: raw.name,
      owner: OwnerType[raw.owner],
      ownerId: raw.owner_id,
      status: StockCatalogStatus[raw.status],
      updatedAt: raw.updated_at,
    });
  }

  static toLot(raw: StockLot): StockLotEntity {
    return new StockLotEntity({
      createdAt: raw.created_at,
      currency: raw.currency ?? undefined,
      expirationDate: raw.expiration_date ?? undefined,
      id: raw.id,
      itemId: raw.item_id,
      leftoverDismissedAt: raw.leftover_dismissed_at ?? undefined,
      leftoverDismissedQuantity:
        raw.leftover_dismissed_quantity === null
          ? undefined
          : toNumber(raw.leftover_dismissed_quantity),
      openedAt: raw.opened_at ?? undefined,
      purchaseDate: raw.purchase_date ?? undefined,
      quantity: toNumber(raw.quantity),
      unitPriceCents: raw.unit_price_cents ?? undefined,
    });
  }

  static toMovement(raw: StockMovement): StockMovementEntity {
    return new StockMovementEntity({
      createdAt: raw.created_at,
      currency: raw.currency ?? undefined,
      gestureId: raw.gesture_id ?? undefined,
      id: raw.id,
      itemId: raw.item_id,
      lotId: raw.lot_id,
      note: raw.note ?? undefined,
      quantity: toNumber(raw.quantity),
      reason: raw.reason ? StockMovementReasons[raw.reason] : undefined,
      type: StockMovementTypes[raw.type],
      unitPriceCents: raw.unit_price_cents ?? undefined,
      userId: raw.user_id ?? undefined,
      valueCents: raw.value_cents ?? undefined,
      valueSource: raw.value_source ? DiscardValueSources[raw.value_source] : undefined,
    });
  }
}

function toNumber(value: { toString(): string }): number {
  return Number(value.toString());
}
