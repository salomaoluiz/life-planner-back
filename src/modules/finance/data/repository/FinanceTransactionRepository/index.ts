import { Inject, Injectable } from '@nestjs/common';

import { fromCalendarDate, toCalendarDate } from '@finance/data/datasource/mapper/CalendarDate';
import { FinanceTransactionMapper } from '@finance/data/datasource/mapper/FinanceTransactionMapper';
import { IFinanceTransactionDatasource } from '@finance/data/repository/datasource/IFinanceTransactionDatasource';
import { OwnerAccess } from '@finance/domain/entity/OwnerAccess';
import TransactionEntity from '@finance/domain/entity/TransactionEntity';
import { SystemCategoryKey, TransactionSource, TransactionType } from '@finance/domain/enum';
import { CurrencyCode } from '@finance/domain/enum/Currency';
import {
  CardInvoicePurchaseCount,
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
  TransactionScalars,
  UnpaidAccountRow,
  UpdateTransactionRepositoryParams,
} from '@finance/domain/repository';
import { SearchTerms } from '@finance/domain/service/TransactionSearch';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

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

  async countCardPurchasesByInvoice(keys: CardInvoiceRef[]): Promise<CardInvoicePurchaseCount[]> {
    const rows = await this.transactionDatasource.countCardPurchases(
      keys.map((key) => ({ credit_card_id: key.creditCardId, invoice_month: key.invoiceMonth })),
    );

    return rows.map((row) => ({
      count: row.count,
      creditCardId: row.credit_card_id,
      invoiceMonth: row.invoice_month,
    }));
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

  async findCardPurchases(
    keys: CardInvoiceRef[],
    search?: SearchTerms,
  ): Promise<TransactionEntity[]> {
    const result = await this.transactionDatasource.findCardPurchases(
      keys.map((key) => ({ credit_card_id: key.creditCardId, invoice_month: key.invoiceMonth })),
      search,
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

  async findInvoiceTotals(creditCardIds: string[]): Promise<CardInvoiceTotal[]> {
    const rows = await this.transactionDatasource.findInvoiceTotals(creditCardIds);

    return rows.map((row) => ({
      amount: row.amount,
      creditCardId: row.credit_card_id,
      earlyPaid: row.early_paid,
      invoiceMonth: row.invoice_month,
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

  async findTransactionScalarsById(id: string): Promise<TransactionScalars | undefined> {
    const row = await this.transactionDatasource.findScalarsById(id);

    if (!row) {
      return undefined;
    }

    return {
      accountId: row.account_id,
      category: {
        systemKey: row.category.system_key
          ? SystemCategoryKey[row.category.system_key as keyof typeof SystemCategoryKey]
          : null,
      },
      categoryId: row.category_id,
      creditCardId: row.credit_card_id,
      currency: row.currency as CurrencyCode,
      date: toCalendarDate(row.date),
      id: row.id,
      installmentNumber: row.installment_number,
      installmentPlanId: row.installment_plan_id,
      invoiceMonth: row.invoice_month,
      occurrenceNumber: row.occurrence_number,
      owner: OwnerType[row.owner],
      ownerId: row.owner_id,
      paid: row.paid === true,
      recurrenceId: row.recurrence_id,
      type: TransactionType[row.type],
    };
  }

  async findTransactionsForExport(query: ExportQuery): Promise<TransactionEntity[]> {
    const result = await this.transactionDatasource.findForExport(toExportParams(query));

    return result.map((row) => FinanceTransactionMapper.toDomain(row));
  }

  async findUnpaidAccountRows(owners: OwnerAccess[], to: string): Promise<UnpaidAccountRow[]> {
    const rows = await this.transactionDatasource.findUnpaidAccountRows(owners, to);

    return rows.map((row) => ({
      accountId: row.account_id,
      categoryId: row.category_id,
      currency: row.currency as CurrencyCode,
      date: toCalendarDate(row.date),
      description: row.description,
      id: row.id,
      occurrenceNumber: row.occurrence_number,
      owner: OwnerType[row.owner],
      ownerId: row.owner_id,
      recurrenceId: row.recurrence_id,
      type: TransactionType[row.type],
      value: row.value,
    }));
  }

  async sumDashboardRows(query: DashboardSumsQuery): Promise<DashboardSum[]> {
    const rows = await this.transactionDatasource.sumDashboardRows({
      account_ids: query.accountIds,
      amount_max: query.amountRange?.maxCents,
      amount_min: query.amountRange?.minCents,
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
      search_category_ids: query.searchCategoryIds,
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
      notes: params.notes,
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

export function toCreateParams(params: CreateTransactionRepositoryParams) {
  return {
    account_id: params.accountId,
    category_id: params.categoryId,
    credit_card_id: params.creditCardId,
    currency: params.currency,
    date: fromCalendarDate(params.date),
    description: params.description,
    invoice_month: params.invoiceMonth,
    notes: params.notes,
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
