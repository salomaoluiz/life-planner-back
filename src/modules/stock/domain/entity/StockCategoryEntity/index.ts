import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

export enum StockCatalogStatus {
  ACTIVE = 'ACTIVE',
  ARCHIVED = 'ARCHIVED',
}

interface IStockCategoryEntity {
  createdAt: Date;
  id: string;
  name: string;
  owner: OwnerType;
  ownerId: string;
  status: StockCatalogStatus;
  updatedAt: Date;
  // Optional properties
  financeCategoryId?: string;
  parentId?: string;
}

class StockCategoryEntity {
  createdAt: Date;
  financeCategoryId?: string;
  id: string;
  name: string;
  owner: OwnerType;
  ownerId: string;
  parentId?: string;
  status: StockCatalogStatus;
  updatedAt: Date;

  constructor(params: IStockCategoryEntity) {
    this.createdAt = params.createdAt;
    this.financeCategoryId = params.financeCategoryId;
    this.id = params.id;
    this.name = params.name;
    this.owner = params.owner;
    this.ownerId = params.ownerId;
    this.parentId = params.parentId;
    this.status = params.status;
    this.updatedAt = params.updatedAt;
  }
}

export default StockCategoryEntity;
