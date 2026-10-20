import CategoryEntity from '@finance/domain/entity/CategoryEntity';
import { OwnerAccess } from '@finance/domain/entity/OwnerAccess';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

export type CategoryScopeKind = 'ALL' | 'FAMILY' | 'PERSONAL';

export function belongsToOwner(category: CategoryEntity, target: OwnerAccess): boolean {
  return category.scopes.some((scope) => sameOwner(scope, target));
}
export function categoryScopeKind(category: CategoryEntity): CategoryScopeKind {
  if (category.allScopes) {
    return 'ALL';
  }

  return category.owner === OwnerType.FAMILY ? 'FAMILY' : 'PERSONAL';
}

function sameOwner(a: OwnerAccess, b: OwnerAccess) {
  return a.owner === b.owner && a.ownerId === b.ownerId;
}

// A category is visible when the caller can act on at least one of its scopes.
export function isVisibleTo(category: CategoryEntity, accessibleOwners: OwnerAccess[]): boolean {
  return category.scopes.some((scope) =>
    accessibleOwners.some((access) => sameOwner(access, scope)),
  );
}
export function sameScopes(a: CategoryEntity, b: CategoryEntity): boolean {
  return a.scopes.length === b.scopes.length && a.scopes.every((scope) => belongsToOwner(b, scope));
}
export function visibleScopes(
  category: CategoryEntity,
  accessibleOwners: OwnerAccess[],
): OwnerAccess[] {
  return category.scopes.filter((scope) =>
    accessibleOwners.some((access) => sameOwner(access, scope)),
  );
}
