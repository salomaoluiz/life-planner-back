import { StockCategory, StockItem, StockLocation, StockLot, StockMovement } from '@db/client';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import { StockItemWithLots } from '@stock/data/repository/datasource/IStockDatasource';
import StockCategoryEntity, { StockCatalogStatus } from '@stock/domain/entity/StockCategoryEntity';
import StockEntity, { StockUnits } from '@stock/domain/entity/StockEntity';
import StockLocationEntity from '@stock/domain/entity/StockLocationEntity';
import StockLotEntity from '@stock/domain/entity/StockLotEntity';
import StockMovementEntity, {
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
      expirationDate: raw.expiration_date ?? undefined,
      id: raw.id,
      itemId: raw.item_id,
      openedAt: raw.opened_at ?? undefined,
      purchaseDate: raw.purchase_date ?? undefined,
      quantity: toNumber(raw.quantity),
    });
  }

  static toMovement(raw: StockMovement): StockMovementEntity {
    return new StockMovementEntity({
      createdAt: raw.created_at,
      gestureId: raw.gesture_id ?? undefined,
      id: raw.id,
      itemId: raw.item_id,
      lotId: raw.lot_id,
      note: raw.note ?? undefined,
      quantity: toNumber(raw.quantity),
      reason: raw.reason ? StockMovementReasons[raw.reason] : undefined,
      type: StockMovementTypes[raw.type],
      userId: raw.user_id ?? undefined,
    });
  }
}

function toNumber(value: { toString(): string }): number {
  return Number(value.toString());
}
