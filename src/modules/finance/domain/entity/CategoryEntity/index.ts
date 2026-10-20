import { OwnerAccess } from '@finance/domain/entity/OwnerAccess';
import { AccountStatus, TransactionType } from '@finance/domain/enum';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

interface ICategoryEntity {
  allScopes: boolean;
  createdAt: Date;
  creatorId?: string;
  depthLevel: number;
  icon: string;
  iconColor: string;
  id: string;
  name: string;
  owner: OwnerType;
  ownerId: string;
  parentId?: string;
  scopes: OwnerAccess[];
  status?: AccountStatus;
  type: TransactionType;
  updatedAt: Date;
}

class CategoryEntity {
  // An ALL category follows every scope of its creator; `owner/ownerId` is the creator's Personal scope.
  allScopes: boolean;
  createdAt: Date;
  creatorId?: string;
  depthLevel: number;
  icon: string;
  iconColor: string;
  id: string;
  name: string;
  owner: OwnerType;
  ownerId: string;
  parentId?: string;
  // Every scope the category belongs to (a single-scope category has exactly one: its owner).
  scopes: OwnerAccess[];
  // ARCHIVED categories leave the pickers that create or change records but keep their history (spec 041).
  status: AccountStatus;
  type: TransactionType;
  updatedAt: Date;

  constructor(params: ICategoryEntity) {
    this.allScopes = params.allScopes;
    this.createdAt = params.createdAt;
    this.creatorId = params.creatorId;
    this.depthLevel = params.depthLevel;
    this.icon = params.icon;
    this.iconColor = params.iconColor;
    this.id = params.id;
    this.name = params.name;
    this.owner = params.owner;
    this.ownerId = params.ownerId;
    this.parentId = params.parentId;
    this.scopes = params.scopes;
    this.status = params.status ?? AccountStatus.ACTIVE;
    this.type = params.type;
    this.updatedAt = params.updatedAt;
  }
}

export default CategoryEntity;
