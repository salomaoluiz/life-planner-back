import { FinancialTag, FinancialTagScope } from '@db/client';
import TagEntity from '@finance/domain/entity/TagEntity';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

export type FinancialTagWithScopes = {
  scopes: FinancialTagScope[];
} & FinancialTag;

export class FinanceTagMapper {
  static toDomain(raw: FinancialTagWithScopes, usageCount = 0): TagEntity {
    const owner = OwnerType[raw.owner];

    return new TagEntity({
      allScopes: raw.all_scopes,
      createdAt: raw.created_at,
      creatorId: raw.creator_id,
      id: raw.id,
      name: raw.name,
      owner,
      ownerId: raw.owner_id,
      scopes: raw.all_scopes
        ? raw.scopes.map((scope) => ({ owner: OwnerType[scope.owner], ownerId: scope.owner_id }))
        : [{ owner, ownerId: raw.owner_id }],
      updatedAt: raw.updated_at,
      usageCount,
    });
  }
}
