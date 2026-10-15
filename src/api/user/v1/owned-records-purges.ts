import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

// Injection token for the "purge everything this owner holds" steps, one per owned module (same idea as
// FAMILY_OWNED_RECORDS_CHECKS). A new owned module appends its purge in UserAPIModule only. Each purge is idempotent
// and returns how many rows it deleted.
export const OWNED_RECORDS_PURGES = 'OWNED_RECORDS_PURGES';

export interface IOwnedRecordsPurge {
  execute(params: { owner: OwnerType; ownerId: string }): Promise<number>;
}
export interface OwnedRecordsPurgeEntry {
  module: string;
  purge: IOwnedRecordsPurge;
}
