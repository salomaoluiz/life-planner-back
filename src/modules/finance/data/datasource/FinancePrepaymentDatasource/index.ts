import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

import { Prisma, TransactionType } from '@db/client';
import { assertInvoicesNotPaid, lockCards } from '@finance/data/datasource/ledger';
import {
  FinancialPrepaymentWithDiscount,
  IFinancePrepaymentDatasource,
  PrepayDatasourceParams,
} from '@finance/data/repository/datasource/IFinancePrepaymentDatasource';
import { Database } from '@shared/infra/db/Database';

const INCLUDE = { discount_transaction: { select: { value: true } } };

// Every write locks the card row first (like purchases, payments and plan writes) and re-reads what it
// decides on INSIDE the lock, so a payment that landed meanwhile is seen (spec 032 NFR).
@Injectable()
export class FinancePrepaymentDatasource implements IFinancePrepaymentDatasource {
  constructor(private readonly db: Database) {}

  async findByPlanId(planId: string): Promise<FinancialPrepaymentWithDiscount | null> {
    return this.db.client.financialInstallmentPrepayment.findUnique({
      include: INCLUDE,
      where: { installment_plan_id: planId },
    });
  }

  async prepay(params: PrepayDatasourceParams): Promise<FinancialPrepaymentWithDiscount> {
    return this.db.client.$transaction(async (tx) => {
      await lockCards(tx, [params.credit_card_id]);

      const existing = await tx.financialInstallmentPrepayment.findUnique({
        select: { id: true },
        where: { installment_plan_id: params.plan_id },
      });

      if (existing) {
        throw new ConflictException('The plan already has a prepayment');
      }

      await assertInvoicesNotPaid(tx, params.credit_card_id, [params.target_invoice_month]);

      const rows = await tx.financialTransaction.findMany({
        orderBy: { installment_number: 'asc' },
        select: { id: true, invoice_month: true, value: true },
        where: {
          installment_plan_id: params.plan_id,
          invoice_month: { gt: params.target_invoice_month },
        },
      });
      const payments = await tx.financialInvoicePayment.findMany({
        select: { invoice_month: true },
        where: {
          credit_card_id: params.credit_card_id,
          invoice_month: { in: rows.map((row) => row.invoice_month as string) },
        },
      });
      const paidMonths = new Set(payments.map((payment) => payment.invoice_month));
      const eligible = rows.filter((row) => !paidMonths.has(row.invoice_month as string));

      if (eligible.length === 0) {
        throw new UnprocessableEntityException('No installment to prepay');
      }

      const total = eligible.reduce((sum, row) => sum + row.value, 0);

      if (params.discount > total) {
        throw new BadRequestException('The discount cannot exceed the prepaid total');
      }

      const record = await tx.financialInstallmentPrepayment.create({
        data: {
          date: params.date,
          installment_plan_id: params.plan_id,
          original_months: Object.fromEntries(
            eligible.map((row) => [row.id, row.invoice_month as string]),
          ),
          owner: params.owner,
          owner_id: params.owner_id,
          target_invoice_month: params.target_invoice_month,
        },
      });

      await tx.financialTransaction.updateMany({
        data: { invoice_month: params.target_invoice_month, prepayment_id: record.id },
        where: { id: { in: eligible.map((row) => row.id) } },
      });

      if (params.discount > 0) {
        const discount = await tx.financialTransaction.create({
          data: {
            category_id: params.category_id,
            credit_card_id: params.credit_card_id,
            date: params.date,
            description: params.discount_description,
            invoice_month: params.target_invoice_month,
            owner: params.owner,
            owner_id: params.owner_id,
            prepayment_id: record.id,
            type: TransactionType.INCOME,
            value: params.discount,
          },
        });

        return tx.financialInstallmentPrepayment.update({
          data: { discount_transaction_id: discount.id },
          include: INCLUDE,
          where: { id: record.id },
        });
      }

      return tx.financialInstallmentPrepayment.findUniqueOrThrow({
        include: INCLUDE,
        where: { id: record.id },
      });
    });
  }

  async undo(planId: string): Promise<void> {
    await this.db.client.$transaction(async (tx) => {
      const plan = await tx.financialInstallmentPlan.findUnique({
        select: { credit_card_id: true },
        where: { id: planId },
      });

      if (!plan) {
        throw new NotFoundException();
      }

      await lockCards(tx, [plan.credit_card_id]);

      const record = await tx.financialInstallmentPrepayment.findUnique({
        where: { installment_plan_id: planId },
      });

      if (!record) {
        throw new NotFoundException('The plan has no prepayment');
      }

      const original = record.original_months as Prisma.JsonObject as Record<string, string>;

      // Neither the target nor a month the installments go back to may have a payment record.
      await assertInvoicesNotPaid(tx, plan.credit_card_id, [
        record.target_invoice_month,
        ...Object.values(original),
      ]);

      for (const [id, month] of Object.entries(original)) {
        await tx.financialTransaction.update({
          data: { invoice_month: month, prepayment_id: null },
          where: { id },
        });
      }

      // The record points at the discount row and the row points back at the record: break the cycle first.
      await tx.financialInstallmentPrepayment.update({
        data: { discount_transaction_id: null },
        where: { id: record.id },
      });
      await tx.financialTransaction.deleteMany({ where: { prepayment_id: record.id } });
      await tx.financialInstallmentPrepayment.delete({ where: { id: record.id } });
    });
  }
}
