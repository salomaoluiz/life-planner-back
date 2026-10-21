import { Inject, Injectable } from '@nestjs/common';

import { fromCalendarDate } from '@finance/data/datasource/mapper/CalendarDate';
import { FinanceTransactionMapper } from '@finance/data/datasource/mapper/FinanceTransactionMapper';
import { IFinanceTransactionDatasource } from '@finance/data/repository/datasource/IFinanceTransactionDatasource';
import { OwnerAccess } from '@finance/domain/entity/OwnerAccess';
import TransactionEntity from '@finance/domain/entity/TransactionEntity';
import { TransactionSource, TransactionType } from '@finance/domain/enum';
import {
  CardInvoiceRef,
  CardInvoiceTotal,
  CreateTransactionRepositoryParams,
  DashboardSum,
  DashboardSumsQuery,
  DuplicateCandidate,
  DuplicateQuery,
  ExportQuery,
  IFinanceTransactionRepository,
  TransactionQuery,
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

  async countByCreditCardId(creditCardId: string): Promise<number> {
    return this.transactionDatasource.countByCreditCardId(creditCardId);
  }

  async countTransactionsForExport(query: ExportQuery): Promise<number> {
    return this.transactionDatasource.countForExport(toExportParams(query));
  }

  async createManyTransactions(rows: CreateTransactionRepositoryParams[]): Promise<number> {
    return this.transactionDatasource.createMany(rows.map((row) => toCreateParams(row)));
  }

  async createTransaction(params: CreateTransactionRepositoryParams): Promise<TransactionEntity> {
    const result = await this.transactionDatasource.create(toCreateParams(params));

    return FinanceTransactionMapper.toDomain(result);
  }

  async deleteTransaction(id: string): Promise<void> {
    await this.transactionDatasource.delete(id);
  }

  async existsByOwner(access: OwnerAccess): Promise<boolean> {
    return this.transactionDatasource.exists({ owner: access.owner, owner_id: access.ownerId });
  }

  async findCardPurchases(keys: CardInvoiceRef[]): Promise<TransactionEntity[]> {
    const result = await this.transactionDatasource.findCardPurchases(
      keys.map((key) => ({ credit_card_id: key.creditCardId, invoice_month: key.invoiceMonth })),
    );

    return result.map((row) => FinanceTransactionMapper.toDomain(row));
  }

  async findDuplicateCandidates(query: DuplicateQuery): Promise<DuplicateCandidate[]> {
    const rows = await this.transactionDatasource.findDuplicateCandidates({
      from: query.from,
      owner: query.owner.owner,
      owner_id: query.owner.ownerId,
      to: query.to,
    });

    return rows.map((row) => ({
      accountId: row.account_id,
      creditCardId: row.credit_card_id,
      date: row.date.toISOString().slice(0, 10),
      description: row.description,
      type: TransactionType[row.type],
      value: row.value,
    }));
  }

  async findTransactionById(id: string): Promise<TransactionEntity | undefined> {
    const result = await this.transactionDatasource.findById(id);

    return result ? FinanceTransactionMapper.toDomain(result) : undefined;
  }

  async findTransactions(
    owners: OwnerAccess[],
    source: TransactionSource = TransactionSource.ACCOUNT,
    filter?: TransactionQuery,
  ): Promise<TransactionEntity[]> {
    const result = await this.transactionDatasource.findByOwners(owners, source, {
      ...filter,
      invoiceRefs: filter?.invoiceRefs?.map((ref) => ({
        credit_card_id: ref.creditCardId,
        invoice_month: ref.invoiceMonth,
      })),
    });

    return result.map((row) => FinanceTransactionMapper.toDomain(row));
  }

  async findTransactionsForExport(query: ExportQuery): Promise<TransactionEntity[]> {
    const result = await this.transactionDatasource.findForExport(toExportParams(query));

    return result.map((row) => FinanceTransactionMapper.toDomain(row));
  }

  async sumCardInvoices(creditCardIds: string[]): Promise<CardInvoiceTotal[]> {
    const rows = await this.transactionDatasource.sumCardInvoices(creditCardIds);

    return rows.map((row) => ({
      amount: row.amount,
      creditCardId: row.credit_card_id,
      earlyPaid: row.early_paid,
      invoiceMonth: row.invoice_month,
    }));
  }

  async sumDashboardRows(query: DashboardSumsQuery): Promise<DashboardSum[]> {
    const rows = await this.transactionDatasource.sumDashboardRows({
      account_ids: query.accountIds,
      by_tag: query.byTag,
      category_ids: query.categoryIds,
      credit_card_ids: query.creditCardIds,
      currency: query.currency,
      from: query.from,
      invoice_refs: query.invoiceRefs.map((ref) => ({
        credit_card_id: ref.creditCardId,
        invoice_month: ref.invoiceMonth,
      })),
      owners: query.owners,
      q: query.q,
      source: query.source,
      tag_ids: query.tagIds,
      to: query.to,
    });

    return rows.map((row) => ({
      amount: row.amount,
      categoryId: row.category_id,
      count: row.count,
      creditCardId: row.credit_card_id,
      date: row.date,
      invoiceMonth: row.invoice_month,
      paid: row.paid,
      tagId: row.tag_id,
      type: TransactionType[row.type],
    }));
  }

  async updateTransaction(params: UpdateTransactionRepositoryParams): Promise<TransactionEntity> {
    const result = await this.transactionDatasource.update({
      account_id: params.accountId,
      category_id: params.categoryId,
      credit_card_id: params.creditCardId,
      date: params.date === undefined ? undefined : fromCalendarDate(params.date),
      description: params.description,
      id: params.id,
      invoice_month: params.invoiceMonth,
      owner: params.owner,
      owner_id: params.ownerId,
      paid: params.paid,
      tag_names: params.tags,
      type: params.type,
      value: params.value,
    });

    return FinanceTransactionMapper.toDomain(result);
  }
}

function toCreateParams(params: CreateTransactionRepositoryParams) {
  return {
    account_id: params.accountId,
    category_id: params.categoryId,
    credit_card_id: params.creditCardId,
    currency: params.currency,
    date: fromCalendarDate(params.date),
    description: params.description,
    invoice_month: params.invoiceMonth,
    owner: params.owner,
    owner_id: params.ownerId,
    paid: params.paid,
    tag_names: params.tags,
    type: params.type,
    value: params.value,
  };
}
function toExportParams(query: ExportQuery) {
  return {
    account_ids: query.accountIds,
    credit_card_ids: query.creditCardIds,
    from: query.from,
    owners: query.owners,
    to: query.to,
  };
}
