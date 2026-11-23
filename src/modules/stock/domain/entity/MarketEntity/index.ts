import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import { StockCatalogStatus } from '@stock/domain/entity/StockCategoryEntity';

interface IMarketEntity {
  createdAt: Date;
  id: string;
  name: string;
  owner: OwnerType;
  ownerId: string;
  status: StockCatalogStatus;
  updatedAt: Date;
  // Optional properties
  neighborhood?: string;
}

// Spec 120 FR 9: a market of one owner; archived, never deleted (purchases and prices point to it).
class MarketEntity {
  createdAt: Date;
  id: string;
  name: string;
  neighborhood?: string;
  owner: OwnerType;
  ownerId: string;
  status: StockCatalogStatus;
  updatedAt: Date;

  constructor(params: IMarketEntity) {
    this.createdAt = params.createdAt;
    this.id = params.id;
    this.name = params.name;
    this.neighborhood = params.neighborhood;
    this.owner = params.owner;
    this.ownerId = params.ownerId;
    this.status = params.status;
    this.updatedAt = params.updatedAt;
  }
}

export default MarketEntity;
