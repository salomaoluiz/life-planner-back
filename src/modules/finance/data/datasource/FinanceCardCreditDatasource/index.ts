import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

import { InvoicePaymentMethod, Prisma, TransactionType } from '@db/client';
import { TRANSACTION_RELATIONS } from '@finance/data/datasource/FinanceTransactionDatasource';
import {
  applyLedgerDeltas,
  assertInvoiceNotPaid,
  lockCards,
  lockTransactionRow,
  toLedgerEntry,
} from '@finance/data/datasource/ledger';
import {
  CardCreditAccountDatasourceParams,
  CreateEarlyPaymentDatasourceParams,
  CreateRefundDatasourceParams,
  IFinanceCardCreditDatasource,
  UpdateEarlyPaymentDatasourceParams,
  UpdateRefundDatasourceParams,
} from '@finance/data/repository/datasource/IFinanceCardCreditDatasource';
import { FinancialTransactionWithRelations } from '@finance/data/repository/datasource/IFinanceTransactionDatasource';
import { SYSTEM_CATEGORY_IDS } from '@finance/domain/entity/SystemCategory';
import { SystemCategoryKey } from '@finance/domain/enum';
import { ledgerDeltas } from '@finance/domain/service/LedgerBalance';
import { Database } from '@shared/infra/db/Database';

const REFUND_CATEGORY_ID = SYSTEM_CATEGORY_IDS[SystemCategoryKey.CARD_REFUND];
const EARLY_PAYMENT_CATEGORY_ID = SYSTEM_CATEGORY_IDS[SystemCategoryKey.CARD_EARLY_PAYMENT];

// Refunds and early payments (spec 032 FR 21-40). Every write locks the card row first, then the rows,
// and re-reads what it decides on INSIDE the lock (the same order as purchases and payments: no deadlock).
@Injectable()
export class FinanceCardCreditDatasource implements IFinanceCardCreditDatasource {
  constructor(private readonly db: Database) {}

  async countRefundsByPlanId(planId: string): Promise<number> {
    return this.db.client.financialTransaction.count({ where: { refunded_plan_id: planId } });
  }

  async countRefundsByTransactionId(transactionId: string): Promise<number> {
    return this.db.client.financialTransaction.count({
      where: { refunded_transaction_id: transactionId },
    });
  }

  private async createDebit(
    tx: Prisma.TransactionClient,
    params: {
      account?: CardCreditAccountDatasourceParams;
      category_id: string;
      currency: string;
      date: Date;
      description: string;
      value: number;
    },
  ): Promise<string> {
    if (!params.account) {
      throw new BadRequestException('An account is required to pay from an account');
    }

    const created = await tx.financialTransaction.create({
      data: {
        account_id: params.account.id,
        category_id: params.category_id,
        currency: params.currency,
        date: params.date,
        description: params.description,
        owner: params.account.owner,
        owner_id: params.account.owner_id,
        paid: true,
        type: TransactionType.EXPENSE,
        value: params.value,
      },
    });

    await applyLedgerDeltas(tx, ledgerDeltas(undefined, toLedgerEntry(created)));

    return created.id;
  }

  async createEarlyPayment(
    params: CreateEarlyPaymentDatasourceParams,
  ): Promise<FinancialTransactionWithRelations> {
    return this.db.client.$transaction(async (tx) => {
      await lockCards(tx, [params.credit_card_id]);
      await assertInvoiceNotPaid(tx, params.credit_card_id, params.invoice_month);
      await assertNetUnchanged(
        tx,
        params.credit_card_id,
        params.invoice_month,
        params.expected_net,
      );

      const debitId =
        params.method === InvoicePaymentMethod.ACCOUNT
          ? await this.createDebit(tx, {
              account: params.account,
              category_id: params.account_category_id,
              currency: params.currency,
              date: params.date,
              description: params.account_description,
              value: params.value,
            })
          : null;

      return tx.financialTransaction.create({
        data: {
          category_id: params.category_id,
          credit_card_id: params.credit_card_id,
          currency: params.currency,
          date: params.date,
          description: params.description,
          invoice_month: params.invoice_month,
          owner: params.owner,
          owner_id: params.owner_id,
          paid_from_transaction_id: debitId,
          payment_method: params.method,
          type: TransactionType.INCOME,
          value: params.value,
        },
        include: TRANSACTION_RELATIONS,
      });
    });
  }

  async createRefund(
    params: CreateRefundDatasourceParams,
  ): Promise<FinancialTransactionWithRelations> {
    return this.db.client.$transaction(async (tx) => {
      await lockCards(tx, [params.credit_card_id]);
      await assertInvoiceNotPaid(tx, params.credit_card_id, params.invoice_month);
      await assertRefundsWithinCap(tx, {
        cap: params.max_linked,
        planId: params.refunded_plan_id,
        transactionId: params.refunded_transaction_id,
        value: params.value,
      });

      return tx.financialTransaction.create({
        data: {
          category_id: params.category_id,
          credit_card_id: params.credit_card_id,
          currency: params.currency,
          date: params.date,
          description: params.description,
          invoice_month: params.invoice_month,
          owner: params.owner,
          owner_id: params.owner_id,
          refunded_plan_id: params.refunded_plan_id,
          refunded_transaction_id: params.refunded_transaction_id,
          type: TransactionType.INCOME,
          value: params.value,
        },
        include: TRANSACTION_RELATIONS,
      });
    });
  }

  // Deletes the card row first (it points at the debit row), then the debit row with its ledger.
  private async cardsOf(tx: Prisma.TransactionClient, id: string): Promise<string[]> {
    const row = await tx.financialTransaction.findUnique({
      select: { credit_card_id: true },
      where: { id },
    });

    return row?.credit_card_id ? [row.credit_card_id] : [];
  }

  async deleteCredit(id: string): Promise<void> {
    await this.db.client.$transaction(async (tx) => {
      await lockCards(tx, await this.cardsOf(tx, id));

      const locked = await lockTransactionRow(tx, id);

      if (!locked) {
        return;
      }

      const stored = await tx.financialTransaction.findUniqueOrThrow({ where: { id } });

      assertCredit(stored.category_id);
      await assertInvoiceNotPaid(tx, locked.creditCardId, locked.invoiceMonth);
      await tx.financialTransaction.deleteMany({ where: { id } });

      if (stored.paid_from_transaction_id) {
        const debit = await lockTransactionRow(tx, stored.paid_from_transaction_id);

        await tx.financialTransaction.deleteMany({
          where: { id: stored.paid_from_transaction_id },
        });
        await applyLedgerDeltas(tx, ledgerDeltas(debit, undefined));
      }
    });
  }

  async updateEarlyPayment(
    params: UpdateEarlyPaymentDatasourceParams,
  ): Promise<FinancialTransactionWithRelations> {
    return this.db.client.$transaction(async (tx) => {
      await lockCards(tx, await this.cardsOf(tx, params.id));

      const locked = await lockTransactionRow(tx, params.id);

      if (!locked) {
        throw new NotFoundException();
      }

      const stored = await tx.financialTransaction.findUniqueOrThrow({ where: { id: params.id } });
      const cardId = stored.credit_card_id as string;
      const month = params.invoice_month ?? (stored.invoice_month as string);

      assertCredit(stored.category_id);

      // With a payment record only the description changes.
      if (!isDescriptionOnly(params)) {
        await assertInvoiceNotPaid(tx, cardId, stored.invoice_month);
        await assertInvoiceNotPaid(tx, cardId, month);

        if (params.expected_net !== undefined) {
          await assertNetUnchanged(tx, cardId, month, params.expected_net);
        }
      }

      const method = params.method ?? (stored.payment_method as InvoicePaymentMethod);
      const debitBefore = stored.paid_from_transaction_id
        ? await lockTransactionRow(tx, stored.paid_from_transaction_id)
        : undefined;
      let debitId = stored.paid_from_transaction_id;

      if (method === InvoicePaymentMethod.ACCOUNT) {
        if (debitId) {
          const debit = await tx.financialTransaction.update({
            data: {
              account_id: params.account?.id,
              date: params.date,
              description: params.account_description,
              owner: params.account?.owner,
              owner_id: params.account?.owner_id,
              value: params.value,
            },
            where: { id: debitId },
          });

          await applyLedgerDeltas(tx, ledgerDeltas(debitBefore, toLedgerEntry(debit)));
        } else {
          debitId = await this.createDebit(tx, {
            account: params.account,
            category_id: SYSTEM_CATEGORY_IDS[SystemCategoryKey.INVOICE_PAYMENT],
            currency: stored.currency,
            date: params.date ?? stored.date,
            description: params.account_description ?? 'Early payment',
            value: params.value ?? stored.value,
          });
        }
      }

      const updated = await tx.financialTransaction.update({
        data: {
          date: params.date,
          description: params.description,
          invoice_month: params.invoice_month,
          paid_from_transaction_id: method === InvoicePaymentMethod.ACCOUNT ? debitId : null,
          payment_method: method,
          value: params.value,
        },
        include: TRANSACTION_RELATIONS,
        where: { id: params.id },
      });

      if (method === InvoicePaymentMethod.EXTERNAL && stored.paid_from_transaction_id) {
        await tx.financialTransaction.deleteMany({
          where: { id: stored.paid_from_transaction_id },
        });
        await applyLedgerDeltas(tx, ledgerDeltas(debitBefore, undefined));
      }

      return updated;
    });
  }

  async updateRefund(
    params: UpdateRefundDatasourceParams,
  ): Promise<FinancialTransactionWithRelations> {
    return this.db.client.$transaction(async (tx) => {
      await lockCards(tx, await this.cardsOf(tx, params.id));

      const locked = await lockTransactionRow(tx, params.id);

      if (!locked) {
        throw new NotFoundException();
      }

      const stored = await tx.financialTransaction.findUniqueOrThrow({ where: { id: params.id } });

      assertCredit(stored.category_id);

      // In a paid invoice only the description can change.
      if (!isRefundDescriptionOnly(params)) {
        await assertInvoiceNotPaid(tx, stored.credit_card_id, stored.invoice_month);
        await assertInvoiceNotPaid(
          tx,
          stored.credit_card_id,
          params.invoice_month ?? stored.invoice_month,
        );
      }

      if (params.max_linked !== undefined) {
        await assertRefundsWithinCap(tx, {
          cap: params.max_linked,
          excludeId: params.id,
          planId:
            params.refunded_plan_id === undefined
              ? stored.refunded_plan_id
              : params.refunded_plan_id,
          transactionId:
            params.refunded_transaction_id === undefined
              ? stored.refunded_transaction_id
              : params.refunded_transaction_id,
          value: params.value ?? stored.value,
        });
      }

      return tx.financialTransaction.update({
        data: {
          date: params.date,
          description: params.description,
          invoice_month: params.invoice_month,
          refunded_plan_id: params.refunded_plan_id,
          refunded_transaction_id: params.refunded_transaction_id,
          value: params.value,
        },
        include: TRANSACTION_RELATIONS,
        where: { id: params.id },
      });
    });
  }
}

// Only refunds and early payments go through this datasource.
function assertCredit(categoryId: string): void {
  if (categoryId !== REFUND_CATEGORY_ID && categoryId !== EARLY_PAYMENT_CATEGORY_ID) {
    throw new UnprocessableEntityException('Not a refund or an early payment');
  }
}
async function assertNetUnchanged(
  tx: Prisma.TransactionClient,
  creditCardId: string,
  invoiceMonth: string,
  expectedNet: number,
): Promise<void> {
  const rows = await tx.financialTransaction.groupBy({
    _sum: { value: true },
    by: ['type'],
    where: { credit_card_id: creditCardId, invoice_month: invoiceMonth },
  });
  const net = rows.reduce(
    (sum, row) => sum + (row.type === TransactionType.INCOME ? -1 : 1) * (row._sum.value ?? 0),
    0,
  );

  if (net !== expectedNet) {
    throw new ConflictException('Invoice changed, reload and try again');
  }
}
// The refunds linked to one purchase (or plan), the new value included, may not pass its value.
async function assertRefundsWithinCap(
  tx: Prisma.TransactionClient,
  params: {
    cap?: number;
    excludeId?: string;
    planId?: null | string;
    transactionId?: null | string;
    value: number;
  },
): Promise<void> {
  if (params.cap === undefined || (!params.planId && !params.transactionId)) {
    return;
  }

  const linked = await tx.financialTransaction.aggregate({
    _sum: { value: true },
    where: {
      id: params.excludeId ? { not: params.excludeId } : undefined,
      ...(params.transactionId
        ? { refunded_transaction_id: params.transactionId }
        : { refunded_plan_id: params.planId }),
    },
  });

  if ((linked._sum.value ?? 0) + params.value > params.cap) {
    throw new UnprocessableEntityException("Refunds can't exceed the purchase value");
  }
}
function isDescriptionOnly(params: UpdateEarlyPaymentDatasourceParams): boolean {
  return (
    params.account === undefined &&
    params.date === undefined &&
    params.invoice_month === undefined &&
    params.method === undefined &&
    params.value === undefined
  );
}
function isRefundDescriptionOnly(params: UpdateRefundDatasourceParams): boolean {
  return (
    params.date === undefined &&
    params.invoice_month === undefined &&
    params.refunded_plan_id === undefined &&
    params.refunded_transaction_id === undefined &&
    params.value === undefined
  );
}
