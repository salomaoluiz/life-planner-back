import { UnprocessableEntityException } from '@nestjs/common';

import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import StockCategoryEntity, { StockCatalogStatus } from '@stock/domain/entity/StockCategoryEntity';
import { StockUnits } from '@stock/domain/entity/StockEntity';
import StockLocationEntity from '@stock/domain/entity/StockLocationEntity';
import { IStockCatalogRepository } from '@stock/domain/repository';
import { quantityError, toMilli } from '@stock/domain/service/StockQuantity';

export interface StockLimits {
  idealQuantity?: null | number;
  minQuantity?: null | number;
  stockOnly: boolean;
  unit: StockUnits;
}

// Spec 116 FR 2 and 18: precision per unit, stock-only without minimum/ideal, ideal above minimum.
export interface CatalogRefs {
  category?: StockCategoryEntity;
  location?: StockLocationEntity;
}

export function assertStockLimits(limits: StockLimits): void {
  const { idealQuantity, minQuantity, stockOnly, unit } = limits;

  if (stockOnly && (minQuantity != null || idealQuantity != null)) {
    throw new UnprocessableEntityException('A stock-only item has no minimum or ideal quantity');
  }

  for (const value of [minQuantity, idealQuantity]) {
    const error = value == null ? undefined : quantityError(unit, value);

    if (error) {
      throw new UnprocessableEntityException(error);
    }
  }

  if (
    minQuantity != null &&
    idealQuantity != null &&
    toMilli(idealQuantity) <= toMilli(minQuantity)
  ) {
    throw new UnprocessableEntityException('Ideal quantity must be greater than the minimum');
  }
}

function isUsable(
  row: StockCategoryEntity | StockLocationEntity | undefined,
  target: { owner: OwnerType; ownerId: string },
): boolean {
  return (
    row !== undefined &&
    row.owner === target.owner &&
    row.ownerId === target.ownerId &&
    row.status === StockCatalogStatus.ACTIVE
  );
}

// An item references only an active category and location of its own owner (else 422).
export async function loadCatalogRefs(
  catalog: IStockCatalogRepository,
  target: { owner: OwnerType; ownerId: string },
  ids: { categoryId?: null | string; locationId?: null | string },
): Promise<CatalogRefs> {
  const [category, location] = await Promise.all([
    ids.categoryId ? catalog.findCategoryById(ids.categoryId) : undefined,
    ids.locationId ? catalog.findLocationById(ids.locationId) : undefined,
  ]);

  if (ids.categoryId && !isUsable(category, target)) {
    throw new UnprocessableEntityException('Category not found for this owner');
  }

  if (ids.locationId && !isUsable(location, target)) {
    throw new UnprocessableEntityException('Location not found for this owner');
  }

  return { category, location };
}
