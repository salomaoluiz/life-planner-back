import { Inject, Injectable } from '@nestjs/common';

import { OwnerType } from '@db/client';
import { fromCalendarDate } from '@finance/data/datasource/mapper/CalendarDate';
import { FinanceSplitMapper } from '@finance/data/datasource/mapper/FinanceSplitMapper';
import { FinanceTransactionMapper } from '@finance/data/datasource/mapper/FinanceTransactionMapper';
import {
  IFinanceSplitDatasource,
  WriteSplitDatasourceParams,
} from '@finance/data/repository/datasource/IFinanceSplitDatasource';
import { IFinanceTransactionDatasource } from '@finance/data/repository/datasource/IFinanceTransactionDatasource';
import SplitEntity from '@finance/domain/entity/SplitEntity';
import { TransactionType } from '@finance/domain/enum';
import {
  IFinanceSplitRepository,
  SplitSummary,
  UpdateSplitRepositoryResult,
  WriteSplitRepositoryParams,
} from '@finance/domain/repository';
import { totalOf, typeOf } from '@finance/domain/service/SplitRules';
import { OwnerType as OwnerDomainType } from '@shared/domain/entity/owner/OwnerEntity';

function toDatasourceParams(params: WriteSplitRepositoryParams): WriteSplitDatasourceParams {
  return {
    account_id: params.accountId,
    created_by: params.createdBy,
    credit_card_id: params.creditCardId,
    currency: params.currency,
    date: fromCalendarDate(params.date),
    description: params.description,
    invoice_month: params.invoiceMonth,
    notes: params.notes,
    occurrence_number: params.occurrenceNumber ?? null,
    owner: params.owner as OwnerType,
    owner_id: params.ownerId,
    paid: params.paid,
    parts: params.parts.map((part) => ({
      category_id: part.categoryId,
      description: part.description,
      id: part.id,
      tag_names: part.tags,
      type: part.type,
      value: part.value,
    })),
    recurrence_id: params.recurrenceId ?? null,
    source_transaction_id: params.sourceTransactionId,
  };
}
function toRulePart(row: { type: string; value: number }) {
  return { type: TransactionType[row.type as keyof typeof TransactionType], value: row.value };
}

@Injectable()
export class FinanceSplitRepository implements IFinanceSplitRepository {
  constructor(
    @Inject('IFinanceSplitDatasource')
    private readonly splitDatasource: IFinanceSplitDatasource,
    @Inject('IFinanceTransactionDatasource')
    private readonly transactionDatasource: IFinanceTransactionDatasource,
  ) {}

  async createSplit(params: WriteSplitRepositoryParams): Promise<SplitEntity> {
    return FinanceSplitMapper.toDomain(
      await this.splitDatasource.create(toDatasourceParams(params)),
    );
  }

  async createSplits(params: WriteSplitRepositoryParams[]): Promise<number> {
    return this.splitDatasource.createMany(params.map((item) => toDatasourceParams(item)));
  }

  async deleteSplit(id: string): Promise<void> {
    await this.splitDatasource.delete(id);
  }

  async findSplitById(id: string): Promise<SplitEntity | undefined> {
    const record = await this.splitDatasource.findById(id);

    return record ? FinanceSplitMapper.toDomain(record) : undefined;
  }

  async findSplitsByIds(ids: string[]): Promise<SplitEntity[]> {
    const records = await this.splitDatasource.findByIds(ids);

    return records.map((record) => FinanceSplitMapper.toDomain(record));
  }

  async findSplitSummaries(ids: string[]): Promise<SplitSummary[]> {
    const records = await this.splitDatasource.findSummaries(ids);

    return records.map((record) => ({
      description: record.description,
      id: record.id,
      notes: record.notes,
      occurrenceNumber: record.occurrence_number,
      owner: OwnerDomainType[record.owner],
      ownerId: record.owner_id,
      paid: record.paid,
      partCount: record.transactions.length,
      recurrenceId: record.recurrence_id,
      stockPurchaseId: record.stock_purchase_id,
      total: totalOf(record.transactions.map(toRulePart)),
      type: typeOf(record.transactions.map(toRulePart)),
    }));
  }

  async setSplitPaid(id: string, paid: boolean): Promise<SplitEntity> {
    return FinanceSplitMapper.toDomain(await this.splitDatasource.setPaid(id, paid));
  }

  async updateSplit(
    id: string,
    params: WriteSplitRepositoryParams,
  ): Promise<UpdateSplitRepositoryResult> {
    const result = await this.splitDatasource.update(id, toDatasourceParams(params));

    if (result.dissolved_id !== undefined) {
      const row = await this.transactionDatasource.findById(result.dissolved_id);

      return { dissolved: row ? FinanceTransactionMapper.toDomain(row) : undefined };
    }

    return { split: result.split ? FinanceSplitMapper.toDomain(result.split) : undefined };
  }
}
