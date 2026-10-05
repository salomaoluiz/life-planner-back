import { StockItem } from '@db/client';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import StockEntity, { StockUnits } from '@stock/domain/entity/StockEntity';

export class StockMapper {
  static toDomain(raw: StockItem): StockEntity {
    return new StockEntity({
      barcode: raw.barcode ?? undefined,
      brand: raw.brand ?? undefined,
      createdAt: raw.created_at,
      description: raw.description,
      expirationDate: raw.expiration_date ?? undefined,
      id: raw.id,
      notes: raw.notes ?? undefined,
      openingDate: raw.opening_date ?? undefined,
      owner: OwnerType[raw.owner],
      ownerId: raw.owner_id,
      purchaseDate: raw.purchase_date ?? undefined,
      quantity: raw.quantity,
      // Prisma's generated StockUnit already carries the lowercase wire values.
      unit: raw.unit as StockUnits,
      updatedAt: raw.updated_at,
    });
  }
}
