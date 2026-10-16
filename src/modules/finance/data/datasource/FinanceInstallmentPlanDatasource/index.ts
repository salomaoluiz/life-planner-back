import { Injectable, NotFoundException } from '@nestjs/common';

import { Prisma } from '@db/client';
import { TRANSACTION_RELATIONS } from '@finance/data/datasource/FinanceTransactionDatasource';
import {
  assertInvoicesNotPaid,
  assertNoPaidInstallment,
  lockCards,
} from '@finance/data/datasource/ledger';
import {
  CreateInstallmentPlanDatasourceParams,
  FinancialInstallmentPlanWithRows,
  IFinanceInstallmentPlanDatasource,
  InstallmentRowDatasourceParams,
  RecreateInstallmentPlanDatasourceParams,
  UpdateInstallmentPlanTextDatasourceParams,
  UpdateInstallmentsFromDatasourceParams,
} from '@finance/data/repository/datasource/IFinanceInstallmentPlanDatasource';
import { Database } from '@shared/infra/db/Database';

// Every write locks the card row first (like invoice payments and purchases), so a payment can't land
// between "check no installment is paid" and the write (spec 030 NFR).
@Injectable()
export class FinanceInstallmentPlanDatasource implements IFinanceInstallmentPlanDatasource {
  constructor(private readonly db: Database) {}

  async create(params: CreateInstallmentPlanDatasourceParams): Promise<string> {
    return this.db.client.$transaction(async (tx) => {
      await lockCards(tx, [params.credit_card_id]);
      await assertInvoicesNotPaid(
        tx,
        params.credit_card_id,
        params.rows.map((row) => row.invoice_month),
      );
      const plan = await tx.financialInstallmentPlan.create({
        data: {
          category_id: params.category_id,
          credit_card_id: params.credit_card_id,
          date: params.date,
          description: params.description,
          installment_count: params.rows.length,
          owner: params.owner,
          owner_id: params.owner_id,
          total_value: sumOf(params.rows),
        },
        select: { id: true },
      });
      await tx.financialTransaction.createMany({
        data: toRows(params.rows, { ...params, plan_id: plan.id }),
      });
      return plan.id;
    });
  }

  async delete(id: string): Promise<void> {
    await this.db.client.$transaction(async (tx) => {
      const cardId = await this.cardOf(tx, id);
      await lockCards(tx, [cardId]);
      await assertNoPaidInstallment(tx, cardId, await this.monthsOf(tx, id));
      await tx.financialTransaction.deleteMany({ where: { installment_plan_id: id } });
      await tx.financialInstallmentPlan.delete({ where: { id } });
    });
  }

  async findById(id: string): Promise<FinancialInstallmentPlanWithRows | null> {
    return this.db.client.financialInstallmentPlan.findUnique({
      include: {
        transactions: {
          include: TRANSACTION_RELATIONS,
          orderBy: { installment_number: 'asc' },
        },
      },
      where: { id },
    });
  }

  async recreate(params: RecreateInstallmentPlanDatasourceParams): Promise<void> {
    await this.db.client.$transaction(async (tx) => {
      const oldCardId = await this.cardOf(tx, params.id);
      await lockCards(tx, [oldCardId, params.credit_card_id]);
      await assertNoPaidInstallment(tx, oldCardId, await this.monthsOf(tx, params.id));
      await assertInvoicesNotPaid(
        tx,
        params.credit_card_id,
        params.rows.map((row) => row.invoice_month),
      );
      const plan = await tx.financialInstallmentPlan.update({
        data: {
          category_id: params.category_id,
          credit_card_id: params.credit_card_id,
          date: params.date,
          description: params.description,
          installment_count: params.rows.length,
          total_value: sumOf(params.rows),
        },
        where: { id: params.id },
      });
      await tx.financialTransaction.deleteMany({ where: { installment_plan_id: params.id } });
      await tx.financialTransaction.createMany({
        data: toRows(params.rows, {
          category_id: params.category_id,
          credit_card_id: params.credit_card_id,
          date: params.date,
          description: params.description,
          owner: plan.owner,
          owner_id: plan.owner_id,
          plan_id: params.id,
        }),
      });
    });
  }
  // Paid installments can still be renamed and recategorized (spec 030 FR 16): no paid check.
  private async cardOf(tx: Prisma.TransactionClient, planId: string): Promise<string> {
    const plan = await tx.financialInstallmentPlan.findUnique({
      select: { credit_card_id: true },
      where: { id: planId },
    });
    if (!plan) {
      throw new NotFoundException();
    }
    return plan.credit_card_id;
  }

  async updateFromNumber(params: UpdateInstallmentsFromDatasourceParams): Promise<void> {
    await this.db.client.$transaction(async (tx) => {
      const cardId = await this.cardOf(tx, params.plan_id);
      const where = {
        installment_number: { gte: params.from_number },
        installment_plan_id: params.plan_id,
      };
      await lockCards(tx, [cardId]);
      if (params.value !== undefined) {
        const rows = await tx.financialTransaction.findMany({
          select: { invoice_month: true },
          where,
        });
        await assertNoPaidInstallment(
          tx,
          cardId,
          rows.map((row) => row.invoice_month as string),
        );
      }
      await tx.financialTransaction.updateMany({
        data: {
          category_id: params.category_id,
          description: params.description,
          value: params.value,
        },
        where,
      });
    });
  }

  async updateText(params: UpdateInstallmentPlanTextDatasourceParams): Promise<void> {
    await this.db.client.$transaction(async (tx) => {
      await lockCards(tx, [await this.cardOf(tx, params.id)]);
      const data = { category_id: params.category_id, description: params.description };
      await tx.financialInstallmentPlan.update({ data, where: { id: params.id } });
      await tx.financialTransaction.updateMany({
        data,
        where: { installment_plan_id: params.id },
      });
    });
  }
  // Read after the card lock, so a payment that committed before it is seen.
  private async monthsOf(tx: Prisma.TransactionClient, planId: string): Promise<string[]> {
    const rows = await tx.financialTransaction.findMany({
      select: { invoice_month: true },
      where: { installment_plan_id: planId },
    });
    return rows.map((row) => row.invoice_month as string);
  }
}
interface RowsContext {
  category_id: string;
  credit_card_id: string;
  date: Date;
  description: string;
  owner: Prisma.FinancialTransactionCreateManyInput['owner'];
  owner_id: string;
  plan_id: string;
}

function sumOf(rows: InstallmentRowDatasourceParams[]): number {
  return rows.reduce((total, row) => total + row.value, 0);
}
function toRows(
  rows: InstallmentRowDatasourceParams[],
  context: RowsContext,
): Prisma.FinancialTransactionCreateManyInput[] {
  return rows.map((row, index) => ({
    category_id: context.category_id,
    credit_card_id: context.credit_card_id,
    date: context.date,
    description: context.description,
    installment_number: index + 1,
    installment_plan_id: context.plan_id,
    invoice_month: row.invoice_month,
    owner: context.owner,
    owner_id: context.owner_id,
    type: 'EXPENSE',
    value: row.value,
  }));
}
