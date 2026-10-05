import { Inject, Injectable } from '@nestjs/common';

import { fromCalendarDate } from '@finance/data/datasource/mapper/CalendarDate';
import { FinanceTransactionMapper } from '@finance/data/datasource/mapper/FinanceTransactionMapper';
import { IFinanceTransactionDatasource } from '@finance/data/repository/datasource/IFinanceTransactionDatasource';
import { OwnerAccess } from '@finance/domain/entity/OwnerAccess';
import TransactionEntity from '@finance/domain/entity/TransactionEntity';
import {
  CreateTransactionRepositoryParams,
  IFinanceTransactionRepository,
  UpdateTransactionRepositoryParams,
} from '@finance/domain/repository';

@Injectable()
export class FinanceTransactionRepository implements IFinanceTransactionRepository {
  constructor(
    @Inject('IFinanceTransactionDatasource')
    private readonly transactionDatasource: IFinanceTransactionDatasource,
  ) {}

  async countByAccountId(accountId: string): Promise<number> {
    return this.transactionDatasource.countByAccountId(accountId);
  }

  async countByCategoryIds(categoryIds: string[]): Promise<number> {
    return this.transactionDatasource.countByCategoryIds(categoryIds);
  }

  async createTransaction(params: CreateTransactionRepositoryParams): Promise<TransactionEntity> {
    const result = await this.transactionDatasource.create({
      account_id: params.accountId,
      category_id: params.categoryId,
      date: fromCalendarDate(params.date),
      description: params.description,
      owner: params.owner,
      owner_id: params.ownerId,
      type: params.type,
      value: params.value,
    });

    return FinanceTransactionMapper.toDomain(result);
  }

  async deleteTransaction(id: string): Promise<void> {
    await this.transactionDatasource.delete(id);
  }

  async existsByOwner(access: OwnerAccess): Promise<boolean> {
    return this.transactionDatasource.exists({ owner: access.owner, owner_id: access.ownerId });
  }

  async findTransactionById(id: string): Promise<TransactionEntity | undefined> {
    const result = await this.transactionDatasource.findById(id);

    return result ? FinanceTransactionMapper.toDomain(result) : undefined;
  }

  async findTransactions(owners: OwnerAccess[]): Promise<TransactionEntity[]> {
    const result = await this.transactionDatasource.findByOwners(owners);

    return result.map((row) => FinanceTransactionMapper.toDomain(row));
  }

  async updateTransaction(params: UpdateTransactionRepositoryParams): Promise<TransactionEntity> {
    const result = await this.transactionDatasource.update({
      account_id: params.accountId,
      category_id: params.categoryId,
      date: params.date === undefined ? undefined : fromCalendarDate(params.date),
      description: params.description,
      id: params.id,
      owner: params.owner,
      owner_id: params.ownerId,
      type: params.type,
      value: params.value,
    });

    return FinanceTransactionMapper.toDomain(result);
  }
}
