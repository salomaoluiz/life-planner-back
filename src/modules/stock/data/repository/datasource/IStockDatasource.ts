import { OwnerType, StockItem, StockUnit } from '@db/client';
import { OwnerAccess } from '@stock/domain/entity/OwnerAccess';

export interface CreateStockDatasourceParams {
  barcode?: string;
  brand?: string;
  description: string;
  expiration_date?: Date;
  notes?: string;
  opening_date?: Date;
  owner: OwnerType;
  owner_id: string;
  purchase_date?: Date;
  quantity: number;
  unit: StockUnit;
}
export interface ExistsStockDatasourceParams {
  owner: OwnerType;
  owner_id: string;
}
export interface IStockDatasource {
  create(params: CreateStockDatasourceParams): Promise<StockItem>;
  delete(id: string): Promise<void>;
  exists(params: ExistsStockDatasourceParams): Promise<boolean>;
  findById(id: string): Promise<null | StockItem>;
  findByOwners(owners: OwnerAccess[]): Promise<StockItem[]>;
  update(params: UpdateStockDatasourceParams): Promise<StockItem>;
}
// `undefined` = unchanged (Prisma no-op), `null` = set NULL.
export interface UpdateStockDatasourceParams {
  barcode?: null | string;
  brand?: null | string;
  description?: string;
  expiration_date?: Date | null;
  id: string;
  notes?: null | string;
  opening_date?: Date | null;
  owner?: OwnerType;
  owner_id?: string;
  purchase_date?: Date | null;
  quantity?: number;
  unit?: StockUnit;
}
