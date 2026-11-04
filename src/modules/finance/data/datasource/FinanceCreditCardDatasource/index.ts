import { Injectable } from '@nestjs/common';

import { AccountStatus, FinancialCreditCard } from '@db/client';
import { BatchRow, batchUpdate } from '@finance/data/datasource/batchUpdate';
import { lockCards } from '@finance/data/datasource/ledger';
import { toCalendarDate } from '@finance/data/datasource/mapper/CalendarDate';
import { toOwnerWhere } from '@finance/data/datasource/mapper/OwnerWhere';
import {
  CreateCreditCardDatasourceParams,
  ExistsCreditCardDatasourceParams,
  IFinanceCreditCardDatasource,
  UpdateCreditCardDatasourceParams,
} from '@finance/data/repository/datasource/IFinanceCreditCardDatasource';
import { OwnerAccess } from '@finance/domain/entity/OwnerAccess';
import { reassignInstallmentMonths } from '@finance/domain/service/InstallmentPlan';
import { invoiceMonthOf } from '@finance/domain/service/InvoiceCalculator';
import { Database } from '@shared/infra/db/Database';

@Injectable()
export class FinanceCreditCardDatasource implements IFinanceCreditCardDatasource {
  constructor(private readonly db: Database) {}

  async create(params: CreateCreditCardDatasourceParams): Promise<FinancialCreditCard> {
    return this.db.client.financialCreditCard.create({ data: params });
  }

  async delete(id: string): Promise<void> {
    await this.db.client.financialCreditCard.deleteMany({ where: { id } });
  }

  async exists(params: ExistsCreditCardDatasourceParams): Promise<boolean> {
    const found = await this.db.client.financialCreditCard.findFirst({
      select: { id: true },
      where: { owner: params.owner, owner_id: params.owner_id },
    });

    return found !== null;
  }

  async findById(id: string): Promise<FinancialCreditCard | null> {
    return this.db.client.financialCreditCard.findUnique({ where: { id } });
  }

  async findByIds(ids: string[]): Promise<FinancialCreditCard[]> {
    if (ids.length === 0) {
      return [];
    }

    return this.db.client.financialCreditCard.findMany({ where: { id: { in: ids } } });
  }

  async findByOwners(
    owners: OwnerAccess[],
    status?: AccountStatus,
  ): Promise<FinancialCreditCard[]> {
    return this.db.client.financialCreditCard.findMany({
      where: status === undefined ? toOwnerWhere(owners) : { ...toOwnerWhere(owners), status },
    });
  }

  // A new closing day recomputes the invoice of every purchase in an unpaid invoice, in the SAME database
  // transaction as the card update. Paid invoices never change (spec 029 FR 9).
  async update(params: UpdateCreditCardDatasourceParams): Promise<FinancialCreditCard> {
    const data = {
      archived_at: params.archived_at,
      brand: params.brand,
      closing_day: params.closing_day,
      color: params.color,
      due_day: params.due_day,
      last_digits: params.last_digits,
      limit: params.limit,
      owner: params.owner,
      owner_id: params.owner_id,
      payment_account_id: params.payment_account_id,
      payment_day: params.payment_day,
      status: params.status,
      title: params.title,
    };

    if (params.closing_day === undefined) {
      return this.db.client.financialCreditCard.update({ data, where: { id: params.id } });
    }

    const closingDay = params.closing_day;

    return this.db.client.$transaction(async (tx) => {
      await lockCards(tx, [params.id]);

      const updated = await tx.financialCreditCard.update({ data, where: { id: params.id } });
      const payments = await tx.financialInvoicePayment.findMany({
        select: { invoice_month: true },
        where: { credit_card_id: params.id },
      });
      const paidMonths = new Set(payments.map((payment) => payment.invoice_month));
      const purchases = await tx.financialTransaction.findMany({
        select: { date: true, id: true, invoice_month: true },
        where: {
          credit_card_id: params.id,
          // Credits keep the invoice they were put on (not date-derived).
          installment_plan_id: null,
          invoice_month: { notIn: [...paidMonths] },
          type: 'EXPENSE',
        },
      });
      // Spec 086: every moved row (purchases and installments) goes out in one statement.
      const moves: BatchRow[] = [];

      for (const purchase of purchases) {
        const month = invoiceMonthOf(toCalendarDate(purchase.date), closingDay);

        if (month !== purchase.invoice_month && !paidMonths.has(month)) {
          moves.push({ key: purchase.id, values: [month] });
        }
      }

      // Installments keep their order: installment 1 by the date rule, k = that + (k - 1); paid rows stay.
      const plans = await tx.financialInstallmentPlan.findMany({
        select: {
          date: true,
          id: true,
          transactions: {
            orderBy: { installment_number: 'asc' },
            select: { id: true, invoice_month: true },
          },
        },
        // A prepaid plan keeps the invoices of its prepayment.
        where: { credit_card_id: params.id, prepayment: null },
      });

      for (const plan of plans) {
        const rows = plan.transactions.map((row) => ({
          id: row.id,
          invoiceMonth: row.invoice_month as string,
          paid: paidMonths.has(row.invoice_month as string),
        }));
        const months = reassignInstallmentMonths(
          rows,
          invoiceMonthOf(toCalendarDate(plan.date), closingDay),
          paidMonths,
        );

        for (const [index, row] of rows.entries()) {
          if (months[index] !== row.invoiceMonth) {
            moves.push({ key: row.id, values: [months[index]] });
          }
        }
      }

      await batchUpdate(
        tx,
        'financial_transactions',
        'id',
        [{ cast: 'char(7)', name: 'invoice_month' }],
        moves,
      );

      return updated;
    });
  }
}
