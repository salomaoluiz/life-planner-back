import { OwnerType } from '@db/client';

export interface FinanceOwnerVersionRow {
  owner: OwnerType;
  owner_id: string;
  version: bigint;
}
export interface IFinanceOwnerVersionDatasource {
  // One query for all the owners.
  findMany(owners: { owner: OwnerType; owner_id: string }[]): Promise<FinanceOwnerVersionRow[]>;
}
