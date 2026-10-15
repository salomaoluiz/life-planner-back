import { Inject, Injectable } from '@nestjs/common';

import { FinanceAccountMapper } from '@finance/data/datasource/mapper/FinanceAccountMapper';
import { IFinanceAccountDatasource } from '@finance/data/repository/datasource/IFinanceAccountDatasource';
import AccountEntity from '@finance/domain/entity/AccountEntity';
import { OwnerAccess } from '@finance/domain/entity/OwnerAccess';
import {
  CreateAccountRepositoryParams,
  FindFutureSumsRepositoryParams,
  IFinanceAccountRepository,
  UpdateAccountRepositoryParams,
} from '@finance/domain/repository';
import { endOfMonth, FutureSums } from '@finance/domain/service/AccountBalance';

@Injectable()
export class FinanceAccountRepository implements IFinanceAccountRepository {
  constructor(
    @Inject('IFinanceAccountDatasource')
    private readonly accountDatasource: IFinanceAccountDatasource,
  ) {}

  async createAccount(params: CreateAccountRepositoryParams): Promise<AccountEntity> {
    const result = await this.accountDatasource.create({
      icon: params.icon,
      initial_balance: params.initialBalance,
      ledger_balance: params.initialBalance,
      name: params.name,
      owner: params.owner,
      owner_id: params.ownerId,
      status: params.status,
    });

    return FinanceAccountMapper.toDomain(result);
  }

  async deleteAccount(id: string): Promise<void> {
    await this.accountDatasource.delete(id);
  }

  async existsByOwner(access: OwnerAccess): Promise<boolean> {
    return this.accountDatasource.exists({ owner: access.owner, owner_id: access.ownerId });
  }

  async findAccountById(id: string): Promise<AccountEntity | undefined> {
    const result = await this.accountDatasource.findById(id);

    return result ? FinanceAccountMapper.toDomain(result) : undefined;
  }

  async findAccounts(owners: OwnerAccess[]): Promise<AccountEntity[]> {
    const result = await this.accountDatasource.findByOwners(owners);

    return result.map((row) => FinanceAccountMapper.toDomain(row));
  }

  async findFutureSums(params: FindFutureSumsRepositoryParams): Promise<FutureSums[]> {
    const rows = await this.accountDatasource.findFutureSums({
      account_ids: params.accountIds,
      end_of_month: endOfMonth(params.today),
      today: params.today,
    });

    return rows.map((row) => ({
      accountId: row.account_id,
      afterEndOfMonth: row.after_end_of_month,
      afterToday: row.after_today,
    }));
  }

  async updateAccount(params: UpdateAccountRepositoryParams): Promise<AccountEntity> {
    const result = await this.accountDatasource.update({
      icon: params.icon,
      id: params.id,
      name: params.name,
      status: params.status,
    });

    return FinanceAccountMapper.toDomain(result);
  }
}
