import { OwnerAccess } from '@finance/domain/entity/OwnerAccess';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

// The `{ id, name }` pair a transaction or recurrence carries (always in the stored order).
export interface TagRef {
  id: string;
  name: string;
}

interface ITagEntity {
  allScopes: boolean;
  createdAt: Date;
  creatorId: string;
  id: string;
  name: string;
  owner: OwnerType;
  ownerId: string;
  scopes: OwnerAccess[];
  updatedAt: Date;
  usageCount?: number;
}

class TagEntity {
  // An ALL tag follows every scope of its creator; `owner/ownerId` is the creator's Personal scope.
  allScopes: boolean;
  createdAt: Date;
  creatorId: string;
  id: string;
  name: string;
  owner: OwnerType;
  ownerId: string;
  // Every scope the tag belongs to (a single-scope tag has exactly one: its owner).
  scopes: OwnerAccess[];
  updatedAt: Date;
  // Transactions plus recurrences that use the tag, counted in the owners the caller asked for.
  usageCount: number;

  constructor(params: ITagEntity) {
    this.allScopes = params.allScopes;
    this.createdAt = params.createdAt;
    this.creatorId = params.creatorId;
    this.id = params.id;
    this.name = params.name;
    this.owner = params.owner;
    this.ownerId = params.ownerId;
    this.scopes = params.scopes;
    this.updatedAt = params.updatedAt;
    this.usageCount = params.usageCount ?? 0;
  }
}

export default TagEntity;
