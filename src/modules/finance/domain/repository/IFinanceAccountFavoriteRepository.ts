export type IFinanceAccountFavoriteRepository = {
  // Only when the row points to that account.
  clear(userId: string, accountId: string): Promise<void>;
  clearByAccount(accountId: string): Promise<void>;
  // Rows pointing to accounts of that family, for `userIds` or, when omitted, for every user.
  clearByFamilyForUsers(params: ClearFamilyFavoritesRepositoryParams): Promise<void>;
  // The favorite account id of the user, if any.
  findByUser(userId: string): Promise<string | undefined>;
  // Replaces the favorite of the user.
  set(userId: string, accountId: string): Promise<void>;
};

interface ClearFamilyFavoritesRepositoryParams {
  familyId: string;
  userIds?: string[];
}

export { ClearFamilyFavoritesRepositoryParams };
