import { OwnerAccess } from '@finance/domain/entity/OwnerAccess';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

// Spec 047 §4: the export reads archived families too, so "All" is every accessible owner (unlike the lists).
// A family the caller cannot reach is dropped, never an error (same as the other lists).
export function resolveExportOwners(
  accessibleOwners: OwnerAccess[],
  scope: 'ALL' | 'FAMILY' | 'USER',
  ownerId?: string,
): OwnerAccess[] {
  if (scope === 'ALL') {
    return accessibleOwners;
  }

  if (scope === 'USER') {
    return accessibleOwners.filter((access) => access.owner === OwnerType.USER);
  }

  return accessibleOwners.filter(
    (access) => access.owner === OwnerType.FAMILY && access.ownerId === ownerId,
  );
}
