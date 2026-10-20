import { OwnerAccess } from '@finance/domain/entity/OwnerAccess';
import TagEntity from '@finance/domain/entity/TagEntity';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

export type TagScopeKind = 'ALL' | 'FAMILY' | 'PERSONAL';

export function belongsToOwner(tag: TagEntity, target: OwnerAccess): boolean {
  return tag.scopes.some((scope) => sameOwner(scope, target));
}
// A tag is visible when the caller can act on at least one of its scopes.
export function isVisibleTo(tag: TagEntity, accessibleOwners: OwnerAccess[]): boolean {
  return tag.scopes.some((scope) => accessibleOwners.some((access) => sameOwner(access, scope)));
}
// Spec 043 FR 2: the names are compared ignoring case.
export function sameName(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}
export function tagScopeKind(tag: TagEntity): TagScopeKind {
  if (tag.allScopes) {
    return 'ALL';
  }

  return tag.owner === OwnerType.FAMILY ? 'FAMILY' : 'PERSONAL';
}
export function visibleScopes(tag: TagEntity, accessibleOwners: OwnerAccess[]): OwnerAccess[] {
  return tag.scopes.filter((scope) => accessibleOwners.some((access) => sameOwner(access, scope)));
}

function sameOwner(a: OwnerAccess, b: OwnerAccess) {
  return a.owner === b.owner && a.ownerId === b.ownerId;
}
