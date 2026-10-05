import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

export interface OwnerAccess {
  owner: OwnerType;
  ownerId: string;
}

export function hasOwnerAccess(accessibleOwners: OwnerAccess[], target: OwnerAccess): boolean {
  return accessibleOwners.some(
    (access) => access.owner === target.owner && access.ownerId === target.ownerId,
  );
}

// Optional `ownerId` query filter: ids the caller cannot access are dropped, never rejected.
export function narrowOwners(accessibleOwners: OwnerAccess[], ownerIds?: string[]): OwnerAccess[] {
  if (ownerIds === undefined) {
    return accessibleOwners;
  }

  return accessibleOwners.filter((access) => ownerIds.includes(access.ownerId));
}
