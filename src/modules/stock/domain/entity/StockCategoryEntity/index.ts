import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

export enum StockCatalogStatus {
  ACTIVE = 'ACTIVE',
  ARCHIVED = 'ARCHIVED',
}

interface IStockCategoryEntity {
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
  financeCategoryId?: string;
  parentId?: string;
}

class StockCategoryEntity {
  color: string;
  createdAt: Date;
  financeCategoryId?: string;
  icon: string;
  id: string;
  name: string;
  owner: OwnerType;
  ownerId: string;
  parentId?: string;
  status: StockCatalogStatus;
  updatedAt: Date;

  constructor(params: IStockCategoryEntity) {
    this.color = params.color;
    this.createdAt = params.createdAt;
    this.financeCategoryId = params.financeCategoryId;
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

export default StockCategoryEntity;
