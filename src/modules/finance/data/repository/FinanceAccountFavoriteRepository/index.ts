import { Inject, Injectable } from '@nestjs/common';

import { IFinanceAccountFavoriteDatasource } from '@finance/data/repository/datasource/IFinanceAccountFavoriteDatasource';
import {
  ClearFamilyFavoritesRepositoryParams,
  IFinanceAccountFavoriteRepository,
} from '@finance/domain/repository';

@Injectable()
export class FinanceAccountFavoriteRepository implements IFinanceAccountFavoriteRepository {
  constructor(
    @Inject('IFinanceAccountFavoriteDatasource')
    private readonly favoriteDatasource: IFinanceAccountFavoriteDatasource,
  ) {}

  async clear(userId: string, accountId: string): Promise<void> {
    await this.favoriteDatasource.deleteForUser(userId, accountId);
  }

  async clearByAccount(accountId: string): Promise<void> {
    await this.favoriteDatasource.deleteByAccount(accountId);
  }

  async clearByFamilyForUsers(params: ClearFamilyFavoritesRepositoryParams): Promise<void> {
    await this.favoriteDatasource.deleteByFamily({
      family_id: params.familyId,
      user_ids: params.userIds,
    });
  }

  async findByUser(userId: string): Promise<string | undefined> {
    return this.favoriteDatasource.findByUser(userId);
  }

  async set(userId: string, accountId: string): Promise<void> {
    await this.favoriteDatasource.upsert(userId, accountId);
  }
}
