import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

// Injection token for the list of "does this owner still have records?" checks, one per owned module.
// Empty today (stock/finance have no use cases yet). Specs 005/006 register their use case here
// (see FamilyAPIModule).
export const FAMILY_OWNED_RECORDS_CHECKS = 'FAMILY_OWNED_RECORDS_CHECKS';

export interface IOwnedRecordsCheck {
  execute(params: { owner: OwnerType; ownerId: string }): Promise<boolean>;
}
