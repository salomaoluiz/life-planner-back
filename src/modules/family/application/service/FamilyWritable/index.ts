import { UnprocessableEntityException } from '@nestjs/common';

import { FamilyStatus } from '@family/domain/enum';
import { ARCHIVED_FAMILY_MESSAGE } from '@shared/domain/error/FamilyArchived';

// Spec 042 FR 9: an archived family is read-only (invites, renames, member removal by the owner).
export function ensureFamilyWritable(family: { status: FamilyStatus }): void {
  if (family.status === FamilyStatus.ARCHIVED) {
    throw new UnprocessableEntityException(ARCHIVED_FAMILY_MESSAGE);
  }
}
