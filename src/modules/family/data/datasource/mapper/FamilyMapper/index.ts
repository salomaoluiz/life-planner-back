import { Family } from '@db/client';
import FamilyEntity from '@family/domain/entity/FamilyEntity';

export class FamilyMapper {
  static toDomain(raw: Family): FamilyEntity {
    return new FamilyEntity({
      createdAt: raw.created_at,
      id: raw.id,
      name: raw.name,
      ownerId: raw.owner_id,
      updatedAt: raw.updated_at,
    });
  }
}
