import { TransactionType } from '@finance/domain/enum';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

interface ICategoryEntity {
  createdAt: Date;
  depthLevel: number;
  icon: string;
  iconColor: string;
  id: string;
  name: string;
  owner: OwnerType;
  ownerId: string;
  parentId?: string;
  type: TransactionType;
  updatedAt: Date;
}

class CategoryEntity {
  createdAt: Date;
  depthLevel: number;
  icon: string;
  iconColor: string;
  id: string;
  name: string;
  owner: OwnerType;
  ownerId: string;
  parentId?: string;
  type: TransactionType;
  updatedAt: Date;

  constructor(params: ICategoryEntity) {
    this.createdAt = params.createdAt;
    this.depthLevel = params.depthLevel;
    this.icon = params.icon;
    this.iconColor = params.iconColor;
    this.id = params.id;
    this.name = params.name;
    this.owner = params.owner;
    this.ownerId = params.ownerId;
    this.parentId = params.parentId;
    this.type = params.type;
    this.updatedAt = params.updatedAt;
  }
}

export default CategoryEntity;
