import { Injectable } from '@nestjs/common';

import { FinancialAccount } from '@db/client';
import { toOwnerWhere } from '@finance/data/datasource/mapper/OwnerWhere';
import {
  CreateAccountDatasourceParams,
  ExistsAccountDatasourceParams,
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

  async update(params: UpdateAccountDatasourceParams): Promise<FinancialAccount> {
    return this.db.client.financialAccount.update({
      data: {
        balance: params.balance,
        icon: params.icon,
        name: params.name,
        status: params.status,
      },
      where: { id: params.id },
    });
  }
}
