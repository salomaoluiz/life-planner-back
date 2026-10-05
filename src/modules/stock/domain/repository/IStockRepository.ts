import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import { OwnerAccess } from '@stock/domain/entity/OwnerAccess';
import StockEntity, { StockUnits } from '@stock/domain/entity/StockEntity';

export type IStockRepository = {
  create(params: CreateStockRepositoryParams): Promise<StockEntity>;
  delete(id: string): Promise<void>;
  existsByOwner(access: OwnerAccess): Promise<boolean>;
  findById(id: string): Promise<StockEntity | undefined>;
  findByOwners(owners: OwnerAccess[]): Promise<StockEntity[]>;
  update(params: UpdateStockRepositoryParams): Promise<StockEntity>;
};

interface CreateStockRepositoryParams {
  barcode?: string;
  brand?: string;
  description: string;
  expirationDate?: Date;
  notes?: string;
  openingDate?: Date;
  owner: OwnerType;
  ownerId: string;
  purchaseDate?: Date;
  quantity: number;
  unit: StockUnits;
}
// `undefined` = unchanged, `null` = clear the column.
interface UpdateStockRepositoryParams {
  barcode?: null | string;
  brand?: null | string;
  description?: string;
  expirationDate?: Date | null;
  id: string;
  notes?: null | string;
  openingDate?: Date | null;
  owner?: OwnerType;
  ownerId?: string;
  purchaseDate?: Date | null;
  quantity?: number;
  unit?: StockUnits;
}

export { CreateStockRepositoryParams, UpdateStockRepositoryParams };
