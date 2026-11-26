import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import { StockCatalogStatus } from '@stock/domain/entity/StockCategoryEntity';

interface IStockLocationEntity {
  color: string;
  createdAt: Date;
  icon: string;
  id: string;
  name: string;
  owner: OwnerType;
  ownerId: string;
  status: StockCatalogStatus;
  updatedAt: Date;
  // Optional properties
  parentId?: string;
}

class StockLocationEntity {
  color: string;
  createdAt: Date;
  icon: string;
  id: string;
  name: string;
  owner: OwnerType;
  ownerId: string;
  parentId?: string;
  status: StockCatalogStatus;
  updatedAt: Date;

  constructor(params: IStockLocationEntity) {
    this.color = params.color;
    this.createdAt = params.createdAt;
    this.icon = params.icon;
    this.id = params.id;
    this.name = params.name;
    this.owner = params.owner;
    this.ownerId = params.ownerId;
    this.parentId = params.parentId;
    this.status = params.status;
    this.updatedAt = params.updatedAt;
  }
}

export default StockLocationEntity;
