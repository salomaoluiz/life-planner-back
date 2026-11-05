import { Injectable } from '@nestjs/common';

import { OwnerType } from '@db/client';
import {
  FinanceOwnerVersionRow,
  IFinanceOwnerVersionDatasource,
} from '@finance/data/repository/datasource/IFinanceOwnerVersionDatasource';
import { Database } from '@shared/infra/db/Database';

@Injectable()
export class FinanceOwnerVersionDatasource implements IFinanceOwnerVersionDatasource {
  constructor(private readonly db: Database) {}

  async findMany(
    owners: { owner: OwnerType; owner_id: string }[],
  ): Promise<FinanceOwnerVersionRow[]> {
    if (owners.length === 0) {
      return [];
    }

    return this.db.client.financeOwnerVersion.findMany({
      select: { owner: true, owner_id: true, version: true },
      where: { OR: owners },
    });
  }
}
