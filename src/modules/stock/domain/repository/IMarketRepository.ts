import MarketEntity from '@stock/domain/entity/MarketEntity';
import { OwnerAccess } from '@stock/domain/entity/OwnerAccess';
import { StockCatalogStatus } from '@stock/domain/entity/StockCategoryEntity';

export interface CreateMarketParams {
  name: string;
  neighborhood?: string;
  owner: OwnerAccess['owner'];
  ownerId: string;
}
export type IMarketRepository = {
  create(params: CreateMarketParams): Promise<MarketEntity>;
  // Deletes the markets of the owner. Idempotent (account and family purge).
  deleteByOwner(access: OwnerAccess): Promise<void>;
  findById(id: string): Promise<MarketEntity | undefined>;
  findByOwners(owners: OwnerAccess[], includeArchived: boolean): Promise<MarketEntity[]>;
  update(params: UpdateMarketParams): Promise<MarketEntity>;
};
export interface UpdateMarketParams {
  id: string;
  name?: string;
  neighborhood?: null | string;
  status?: StockCatalogStatus;
}
