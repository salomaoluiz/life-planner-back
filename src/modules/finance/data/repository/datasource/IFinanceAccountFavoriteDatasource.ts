export interface DeleteFavoritesByFamilyDatasourceParams {
  family_id: string;
  // Only these users; every user when omitted.
  user_ids?: string[];
}
export interface IFinanceAccountFavoriteDatasource {
  deleteByAccount(accountId: string): Promise<void>;
  deleteByFamily(params: DeleteFavoritesByFamilyDatasourceParams): Promise<void>;
  // Deletes the row only when it points to `accountId`.
  deleteForUser(userId: string, accountId: string): Promise<void>;
  findByUser(userId: string): Promise<string | undefined>;
  upsert(userId: string, accountId: string): Promise<void>;
}
