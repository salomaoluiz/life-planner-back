import { OwnerAccess } from '@finance/domain/entity/OwnerAccess';

export type IFinanceOwnerVersionRepository = {
  // Spec 092: the data version of each owner, in the same order as `owners` (0 when never written). One query.
  findVersions(owners: OwnerAccess[]): Promise<number[]>;
};
