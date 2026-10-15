import { Injectable } from '@nestjs/common';

import { FinancialAccount, Prisma } from '@db/client';
import { toOwnerWhere } from '@finance/data/datasource/mapper/OwnerWhere';
import {
  CreateAccountDatasourceParams,
  ExistsAccountDatasourceParams,
  FindFutureSumsDatasourceParams,
  FutureSumsRow,
  IFinanceAccountDatasource,
  UpdateAccountDatasourceParams,
} from '@finance/data/repository/datasource/IFinanceAccountDatasource';
import { OwnerAccess } from '@finance/domain/entity/OwnerAccess';
import { Database } from '@shared/infra/db/Database';

@Injectable()
export class FinanceAccountDatasource implements IFinanceAccountDatasource {
  constructor(private readonly db: Database) {}

  async create(params: CreateAccountDatasourceParams): Promise<FinancialAccount> {
    return this.db.client.financialAccount.create({ data: params });
  }

  async delete(id: string): Promise<void> {
    await this.db.client.financialAccount.deleteMany({ where: { id } });
  }

  async exists(params: ExistsAccountDatasourceParams): Promise<boolean> {
    const found = await this.db.client.financialAccount.findFirst({
      select: { id: true },
      where: { owner: params.owner, owner_id: params.owner_id },
    });

    return found !== null;
  }

  async findById(id: string): Promise<FinancialAccount | null> {
    return this.db.client.financialAccount.findUnique({ where: { id } });
  }

  async findByOwners(owners: OwnerAccess[]): Promise<FinancialAccount[]> {
    return this.db.client.financialAccount.findMany({ where: toOwnerWhere(owners) });
  }

  // Signed sums (income +, expense −) of the rows dated after `today` / after the end of its month,
  // for all the accounts in ONE grouped query served by the (account_id, date) index. It never
  // touches the history: current = ledger − afterToday, projected = ledger − afterEndOfMonth.
  async findFutureSums(params: FindFutureSumsDatasourceParams): Promise<FutureSumsRow[]> {
    if (params.account_ids.length === 0) {
      return [];
    }

    const rows = await this.db.client.$queryRaw<
      { account_id: string; after_end_of_month: bigint; after_today: bigint }[]
    >(
      Prisma.sql`
        SELECT "account_id",
          COALESCE(SUM(CASE WHEN "type" = 'INCOME' THEN "value" ELSE -"value" END), 0) AS "after_today",
          COALESCE(SUM(CASE WHEN "type" = 'INCOME' THEN "value" ELSE -"value" END)
            FILTER (WHERE "date" > ${params.end_of_month}::date), 0) AS "after_end_of_month"
        FROM "financial_transactions"
        WHERE "account_id" IN (${Prisma.join(params.account_ids)}) AND "date" > ${params.today}::date
        GROUP BY "account_id"`,
    );

    return rows.map((row) => ({
      account_id: row.account_id,
      after_end_of_month: Number(row.after_end_of_month),
      after_today: Number(row.after_today),
    }));
  }

  async update(params: UpdateAccountDatasourceParams): Promise<FinancialAccount> {
    return this.db.client.financialAccount.update({
      data: {
        icon: params.icon,
        name: params.name,
        status: params.status,
      },
      where: { id: params.id },
    });
  }
}
