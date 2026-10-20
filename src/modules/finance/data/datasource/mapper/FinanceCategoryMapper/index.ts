import { FinancialCategory, FinancialCategoryScope } from '@db/client';
import CategoryEntity from '@finance/domain/entity/CategoryEntity';
import { TransactionType } from '@finance/domain/enum';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

export type FinancialCategoryWithScopes = {
  scopes: FinancialCategoryScope[];
} & FinancialCategory;

export class FinanceCategoryMapper {
  static toDomain(raw: FinancialCategoryWithScopes): CategoryEntity {
    // System categories are owner-less; they have their own ids in the domain and never go through here.
    if (raw.owner === null || raw.owner_id === null || raw.type === null) {
      throw new Error('System categories are not user categories');
    }

    const owner = OwnerType[raw.owner];

    return new CategoryEntity({
      allScopes: raw.all_scopes,
      createdAt: raw.created_at,
      creatorId: raw.creator_id ?? undefined,
      depthLevel: raw.depth_level,
      icon: raw.icon,
      iconColor: raw.icon_color,
      id: raw.id,
      name: raw.name,
      owner,
      ownerId: raw.owner_id,
      parentId: raw.parent_id ?? undefined,
      scopes: raw.all_scopes
        ? raw.scopes.map((scope) => ({ owner: OwnerType[scope.owner], ownerId: scope.owner_id }))
        : [{ owner, ownerId: raw.owner_id }],
      type: TransactionType[raw.type],
      updatedAt: raw.updated_at,
    });
  }
}
