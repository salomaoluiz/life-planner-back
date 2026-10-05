import { Injectable } from '@nestjs/common';

import { toOwnerWhere } from '@finance/data/datasource/mapper/OwnerWhere';
import {
  CreateTransactionDatasourceParams,
  ExistsTransactionDatasourceParams,
  FinancialTransactionWithRelations,
  IFinanceTransactionDatasource,
  UpdateTransactionDatasourceParams,
} from '@finance/data/repository/datasource/IFinanceTransactionDatasource';
import { OwnerAccess } from '@finance/domain/entity/OwnerAccess';
import { Database } from '@shared/infra/db/Database';

// Account and category summaries come back in the same query (no N+1).
const RELATIONS = {
  account: { select: { icon: true, id: true, name: true } },
  category: { select: { icon: true, icon_color: true, id: true, name: true } },
};

@Injectable()
export class FinanceTransactionDatasource implements IFinanceTransactionDatasource {
  constructor(private readonly db: Database) {}

  async countByAccountId(accountId: string): Promise<number> {
    return this.db.client.financialTransaction.count({ where: { account_id: accountId } });
  }

  async countByCategoryIds(categoryIds: string[]): Promise<number> {
    return this.db.client.financialTransaction.count({
      where: { category_id: { in: categoryIds } },
    });
  }

  async create(
    params: CreateTransactionDatasourceParams,
  ): Promise<FinancialTransactionWithRelations> {
    return this.db.client.financialTransaction.create({ data: params, include: RELATIONS });
  }

  async delete(id: string): Promise<void> {
    await this.db.client.financialTransaction.deleteMany({ where: { id } });
  }

  async exists(params: ExistsTransactionDatasourceParams): Promise<boolean> {
    const found = await this.db.client.financialTransaction.findFirst({
      select: { id: true },
      where: { owner: params.owner, owner_id: params.owner_id },
    });

    return found !== null;
  }

  async findById(id: string): Promise<FinancialTransactionWithRelations | null> {
    return this.db.client.financialTransaction.findUnique({
      include: RELATIONS,
      where: { id },
    });
  }

  async findByOwners(owners: OwnerAccess[]): Promise<FinancialTransactionWithRelations[]> {
    return this.db.client.financialTransaction.findMany({
      include: RELATIONS,
      orderBy: [{ date: 'desc' }, { created_at: 'desc' }],
      where: toOwnerWhere(owners),
    });
  }

  async update(
    params: UpdateTransactionDatasourceParams,
  ): Promise<FinancialTransactionWithRelations> {
    return this.db.client.financialTransaction.update({
      data: {
        account_id: params.account_id,
        category_id: params.category_id,
        date: params.date,
        description: params.description,
        owner: params.owner,
        owner_id: params.owner_id,
        type: params.type,
        value: params.value,
      },
      include: RELATIONS,
      where: { id: params.id },
    });
  }
}
