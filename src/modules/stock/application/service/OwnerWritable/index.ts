import { UnprocessableEntityException } from '@nestjs/common';

import { ARCHIVED_FAMILY_MESSAGE } from '@shared/domain/error/FamilyArchived';
import { OwnerAccess } from '@stock/domain/entity/OwnerAccess';

// Spec 042 FR 9: any write whose owner is an archived family is refused (422). A target the caller
// cannot access is not handled here: the callers already answer 404 for it.
export function ensureOwnerWritable(
  accessibleOwners: OwnerAccess[],
  target: Pick<OwnerAccess, 'owner' | 'ownerId'>,
): void {
  const access = accessibleOwners.find(
    (item) => item.owner === target.owner && item.ownerId === target.ownerId,
  );

  if (access?.archived) {
    throw new UnprocessableEntityException(ARCHIVED_FAMILY_MESSAGE);
  }
}
