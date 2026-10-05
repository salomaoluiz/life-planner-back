import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

// Injection token for the list of "does this owner still have records?" checks, one per owned module.
// Finance (spec 006) is registered in FamilyAPIModule; spec 005 (stock) appends its own check there.
export const FAMILY_OWNED_RECORDS_CHECKS = 'FAMILY_OWNED_RECORDS_CHECKS';

export interface IOwnedRecordsCheck {
  execute(params: { owner: OwnerType; ownerId: string }): Promise<boolean>;
}
