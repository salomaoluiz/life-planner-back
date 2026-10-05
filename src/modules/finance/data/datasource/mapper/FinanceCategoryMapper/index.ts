import { FinancialCategory } from '@db/client';
import CategoryEntity from '@finance/domain/entity/CategoryEntity';
import { TransactionType } from '@finance/domain/enum';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

export class FinanceCategoryMapper {
  static toDomain(raw: FinancialCategory): CategoryEntity {
    return new CategoryEntity({
      createdAt: raw.created_at,
      depthLevel: raw.depth_level,
      icon: raw.icon,
      iconColor: raw.icon_color,
      id: raw.id,
      name: raw.name,
      owner: OwnerType[raw.owner],
      ownerId: raw.owner_id,
      parentId: raw.parent_id ?? undefined,
      type: TransactionType[raw.type],
      updatedAt: raw.updated_at,
    });
  }
}
