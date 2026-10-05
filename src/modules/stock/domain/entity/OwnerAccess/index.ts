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

// Optional `ownerId` query filter: an id the caller cannot access narrows to [] and is never rejected.
export function narrowOwners(accessibleOwners: OwnerAccess[], ownerId?: string): OwnerAccess[] {
  if (ownerId === undefined) {
    return accessibleOwners;
  }

  return accessibleOwners.filter((access) => access.ownerId === ownerId);
}
