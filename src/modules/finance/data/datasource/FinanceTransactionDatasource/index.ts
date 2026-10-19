import { Injectable, NotFoundException } from '@nestjs/common';

import {
  applyLedgerDeltas,
  assertInvoiceNotPaid,
  lockCards,
  lockTransactionRow,
  toLedgerEntry,
} from '@finance/data/datasource/ledger';
import { toOwnerWhere } from '@finance/data/datasource/mapper/OwnerWhere';
import {
  CardInvoiceKey,
  CardInvoiceSum,
  CreateTransactionDatasourceParams,
  ExistsTransactionDatasourceParams,
  FinancialTransactionWithRelations,
  FindTransactionsFilter,
  IFinanceTransactionDatasource,
  UpdateTransactionDatasourceParams,
} from '@finance/data/repository/datasource/IFinanceTransactionDatasource';
import { OwnerAccess } from '@finance/domain/entity/OwnerAccess';
import { SYSTEM_CATEGORY_IDS } from '@finance/domain/entity/SystemCategory';
import { SystemCategoryKey, TransactionSource, TransactionType } from '@finance/domain/enum';
import { ledgerDeltas } from '@finance/domain/service/LedgerBalance';
import { Database } from '@shared/infra/db/Database';

// Account and category summaries come back in the same query (no N+1).
export const TRANSACTION_RELATIONS = {
  account: { select: { icon: true, id: true, name: true } },
  category: {
    select: {
      exclude_from_totals: true,
      icon: true,
      icon_color: true,
      id: true,
      name: true,
      system_key: true,
    },
  },
  credit_card: { select: { color: true, id: true, last_digits: true, title: true } },
  early_payment: { select: { credit_card_id: true, id: true, invoice_month: true } },
  installment_plan: { select: { installment_count: true } },
  paid_from_transaction: {
    select: { account: { select: { name: true } }, account_id: true },
  },
  recurrence: { select: { end_date: true, first_number: true, frequency: true, start_date: true } },
  refunded_plan: { select: { description: true } },
  refunded_transaction: { select: { description: true } },
};

@Injectable()
export class FinanceTransactionDatasource implements IFinanceTransactionDatasource {
  constructor(private readonly db: Database) {}

  async countByAccountId(accountId: string): Promise<number> {
    return this.db.client.financialTransaction.count({ where: { account_id: accountId } });
  }

  async countByCategoryIds(categoryIds: string[]): Promise<number> {
    // A plan keeps its own category even when every installment was recategorized: it blocks the delete too.
    const [transactions, plans, series] = await Promise.all([
      this.db.client.financialTransaction.count({ where: { category_id: { in: categoryIds } } }),
      this.db.client.financialInstallmentPlan.count({
        where: { category_id: { in: categoryIds } },
      }),
      this.db.client.financialRecurrence.count({ where: { category_id: { in: categoryIds } } }),
    ]);

    return transactions + plans + series;
  }

  async countByCreditCardId(creditCardId: string): Promise<number> {
    return this.db.client.financialTransaction.count({ where: { credit_card_id: creditCardId } });
  }

  // The row and the ledger of its account change in ONE database transaction (spec 028).
  async create(
    params: CreateTransactionDatasourceParams,
  ): Promise<FinancialTransactionWithRelations> {
    return this.db.client.$transaction(async (tx) => {
      await lockCards(tx, params.credit_card_id ? [params.credit_card_id] : []);
      await assertInvoiceNotPaid(tx, params.credit_card_id, params.invoice_month);

      const created = await tx.financialTransaction.create({
        data: params,
        include: TRANSACTION_RELATIONS,
      });

      await applyLedgerDeltas(tx, ledgerDeltas(undefined, toLedgerEntry(created)));

      return created;
    });
  }

  async delete(id: string): Promise<void> {
    await this.db.client.$transaction(async (tx) => {
      await lockCards(tx, await this.cardsOf(tx, id));

      const stored = await lockTransactionRow(tx, id);

      if (!stored) {
        return;
      }

      await assertInvoiceNotPaid(tx, stored.creditCardId, stored.invoiceMonth);

      await tx.financialTransaction.deleteMany({ where: { id } });
      await applyLedgerDeltas(tx, ledgerDeltas(stored, undefined));
    });
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
      include: TRANSACTION_RELATIONS,
      where: { id },
    });
  }

  // Default source ACCOUNT: account rows without the invoice payment transactions (the paid invoice line stands for them).
  async findByOwners(
    owners: OwnerAccess[],
    source: TransactionSource = TransactionSource.ACCOUNT,
    filter: FindTransactionsFilter = {},
  ): Promise<FinancialTransactionWithRelations[]> {
    const sourceWhere =
      source === TransactionSource.CARD
        ? {
            credit_card_id: filter.creditCardId ?? { not: null },
            invoice_month: filter.invoiceMonth,
          }
        : {
            // The account row of an early payment (it has a card row pointing at it) stays in the list.
            credit_card_id: null,
            OR: [
              { category: { system_key: null } },
              { category: { system_key: { not: SystemCategoryKey.INVOICE_PAYMENT } } },
              { early_payment: { isNot: null } },
            ],
          };

    return this.db.client.financialTransaction.findMany({
      include: TRANSACTION_RELATIONS,
      orderBy: [{ date: 'desc' }, { created_at: 'desc' }],
      where: { AND: [toOwnerWhere(owners), sourceWhere] },
    });
  }

  async findCardPurchases(keys: CardInvoiceKey[]): Promise<FinancialTransactionWithRelations[]> {
    if (keys.length === 0) {
      return [];
    }

    return this.db.client.financialTransaction.findMany({
      include: TRANSACTION_RELATIONS,
      orderBy: [{ date: 'asc' }, { created_at: 'asc' }],
      where: { OR: keys.map((key) => ({ ...key })) },
    });
  }

  // One grouped query for every card: the sum of each (card, invoice month).
  async sumCardInvoices(creditCardIds: string[]): Promise<CardInvoiceSum[]> {
    if (creditCardIds.length === 0) {
      return [];
    }

    const rows = await this.db.client.financialTransaction.groupBy({
      _sum: { value: true },
      by: ['credit_card_id', 'invoice_month', 'type', 'category_id'],
      where: { credit_card_id: { in: creditCardIds } },
    });
    const sums = new Map<string, CardInvoiceSum>();

    // Net = purchases (EXPENSE) minus every credit (INCOME); early payments are also counted apart.
    for (const row of rows) {
      const key = `${row.credit_card_id}|${row.invoice_month}`;
      const sum = sums.get(key) ?? {
        amount: 0,
        credit_card_id: row.credit_card_id as string,
        early_paid: 0,
        invoice_month: row.invoice_month as string,
      };
      const value = row._sum.value ?? 0;

      sum.amount += row.type === TransactionType.INCOME ? -value : value;
      if (row.category_id === SYSTEM_CATEGORY_IDS[SystemCategoryKey.CARD_EARLY_PAYMENT]) {
        sum.early_paid += value;
      }
      sums.set(key, sum);
    }

    return [...sums.values()];
  }

  // The old values come from the row locked INSIDE this transaction, never from an earlier read.
  private async cardsOf(tx: Parameters<typeof lockCards>[0], id: string): Promise<string[]> {
    const row = await tx.financialTransaction.findUnique({
      select: { credit_card_id: true },
      where: { id },
    });

    return row?.credit_card_id ? [row.credit_card_id] : [];
  }

  async update(
    params: UpdateTransactionDatasourceParams,
  ): Promise<FinancialTransactionWithRelations> {
    return this.db.client.$transaction(async (tx) => {
      // Cards first, rows second: the same order as the invoice payment, so the two never deadlock.
      await lockCards(tx, [
        ...(await this.cardsOf(tx, params.id)),
        ...(params.credit_card_id ? [params.credit_card_id] : []),
      ]);

      const stored = await lockTransactionRow(tx, params.id);

      if (!stored) {
        throw new NotFoundException();
      }

      // In a paid invoice only the description and the category can change (spec 030 FR 16).
      if (!isTextOnly(params)) {
        await assertInvoiceNotPaid(tx, stored.creditCardId, stored.invoiceMonth);
        await assertInvoiceNotPaid(
          tx,
          params.credit_card_id === undefined ? stored.creditCardId : params.credit_card_id,
          params.invoice_month === undefined ? stored.invoiceMonth : params.invoice_month,
        );
      }

      const updated = await tx.financialTransaction.update({
        data: {
          account_id: params.account_id,
          category_id: params.category_id,
          credit_card_id: params.credit_card_id,
          date: params.date,
          description: params.description,
          invoice_month: params.invoice_month,
          owner: params.owner,
          owner_id: params.owner_id,
          paid: params.paid,
          type: params.type,
          value: params.value,
        },
        include: TRANSACTION_RELATIONS,
        where: { id: params.id },
      });

      await applyLedgerDeltas(tx, ledgerDeltas(stored, toLedgerEntry(updated)));

      return updated;
    });
  }
}

function isTextOnly(params: UpdateTransactionDatasourceParams): boolean {
  return (
    params.account_id === undefined &&
    params.credit_card_id === undefined &&
    params.date === undefined &&
    params.invoice_month === undefined &&
    params.owner === undefined &&
    params.owner_id === undefined &&
    params.type === undefined &&
    params.value === undefined
  );
}
