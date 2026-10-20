import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

export interface OwnerAccess {
  // Spec 042: the family is archived (read-only for everyone); absent means writable.
  archived?: boolean;
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
    // "All" (no explicit owner) skips archived families; an explicit id still reaches their data.
    return accessibleOwners.filter((access) => !access.archived);
  }

  return accessibleOwners.filter((access) => ownerIds.includes(access.ownerId));
}
