import { OwnerAccess } from '@stock/domain/entity/OwnerAccess';

export function toOwnerWhere(owners: OwnerAccess[]) {
  return {
    OR: owners.map((access) => ({ owner: access.owner, owner_id: access.ownerId })),
  };
}
