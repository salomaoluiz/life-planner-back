import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

// Injection token for the list of "does this owner still have records?" checks, one per owned module.
// Finance (spec 006) and stock (spec 005) are registered in FamilyAPIModule; a new owned module appends its own check there.
export const FAMILY_OWNED_RECORDS_CHECKS = 'FAMILY_OWNED_RECORDS_CHECKS';

export interface IOwnedRecordsCheck {
  execute(params: { owner: OwnerType; ownerId: string }): Promise<boolean>;
}
