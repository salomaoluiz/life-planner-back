import { OwnerAccess } from '@finance/domain/entity/OwnerAccess';

export type IFinanceOwnerDataRepository = {
  // Deletes every transaction, category and account of the owner. Idempotent; returns the rows deleted.
  deleteAllByOwner(access: OwnerAccess): Promise<number>;
};
