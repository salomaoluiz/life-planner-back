import { Injectable } from '@nestjs/common';

import {
  DeleteFavoritesByFamilyDatasourceParams,
  IFinanceAccountFavoriteDatasource,
} from '@finance/data/repository/datasource/IFinanceAccountFavoriteDatasource';
import { Database } from '@shared/infra/db/Database';

@Injectable()
export class FinanceAccountFavoriteDatasource implements IFinanceAccountFavoriteDatasource {
  constructor(private readonly db: Database) {}

  async deleteByAccount(accountId: string): Promise<void> {
    await this.db.client.financialAccountFavorite.deleteMany({ where: { account_id: accountId } });
  }

  async deleteByFamily(params: DeleteFavoritesByFamilyDatasourceParams): Promise<void> {
    await this.db.client.financialAccountFavorite.deleteMany({
      where: {
        account: { owner: 'FAMILY', owner_id: params.family_id },
        ...(params.user_ids ? { user_id: { in: params.user_ids } } : {}),
      },
    });
  }

  async deleteForUser(userId: string, accountId: string): Promise<void> {
    await this.db.client.financialAccountFavorite.deleteMany({
      where: { account_id: accountId, user_id: userId },
    });
  }

  // ONE small read per account list/read (spec 094 FR 9).
  async findByUser(userId: string): Promise<string | undefined> {
    const row = await this.db.client.financialAccountFavorite.findUnique({
      select: { account_id: true },
      where: { user_id: userId },
    });

    return row?.account_id;
  }

  async upsert(userId: string, accountId: string): Promise<void> {
    await this.db.client.financialAccountFavorite.upsert({
      create: { account_id: accountId, user_id: userId },
      update: { account_id: accountId },
      where: { user_id: userId },
    });
  }
}
