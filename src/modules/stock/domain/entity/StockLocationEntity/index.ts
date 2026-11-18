import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import { StockCatalogStatus } from '@stock/domain/entity/StockCategoryEntity';

interface IStockLocationEntity {
  createdAt: Date;
  id: string;
  name: string;
  owner: OwnerType;
  ownerId: string;
  status: StockCatalogStatus;
  updatedAt: Date;
}

class StockLocationEntity {
  createdAt: Date;
  id: string;
  name: string;
  owner: OwnerType;
  ownerId: string;
  status: StockCatalogStatus;
  updatedAt: Date;

  constructor(params: IStockLocationEntity) {
    this.createdAt = params.createdAt;
    this.id = params.id;
    this.name = params.name;
    this.owner = params.owner;
    this.ownerId = params.ownerId;
    this.status = params.status;
    this.updatedAt = params.updatedAt;
  }
}

export default StockLocationEntity;
