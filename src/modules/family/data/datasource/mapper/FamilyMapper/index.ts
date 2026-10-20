import { Family } from '@db/client';
import FamilyEntity from '@family/domain/entity/FamilyEntity';
import { FamilyStatus } from '@family/domain/enum';

export class FamilyMapper {
  static toDomain(raw: Family): FamilyEntity {
    return new FamilyEntity({
      createdAt: raw.created_at,
      id: raw.id,
      name: raw.name,
      ownerId: raw.owner_id,
      status: FamilyStatus[raw.status],
      updatedAt: raw.updated_at,
    });
  }
}
