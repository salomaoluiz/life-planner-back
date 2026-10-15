import { OwnerType } from '@db/client';

export interface DeleteAllByOwnerDatasourceParams {
  owner: OwnerType;
  owner_id: string;
}
export interface IFinanceOwnerDataDatasource {
  // Total rows deleted (transactions + categories + accounts), all in one database transaction.
  deleteAllByOwner(params: DeleteAllByOwnerDatasourceParams): Promise<number>;
}
