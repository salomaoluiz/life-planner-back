import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';

import { InvoicePaymentMethod, Prisma, TransactionType } from '@db/client';
import {
  applyLedgerDeltas,
  lockCards,
  lockTransactionRow,
  toLedgerEntry,
} from '@finance/data/datasource/ledger';
import {
  FinancialInvoicePaymentWithAccount,
  IFinanceInvoicePaymentDatasource,
  PayInvoiceDatasourceParams,
} from '@finance/data/repository/datasource/IFinanceInvoicePaymentDatasource';
import { ledgerDeltas } from '@finance/domain/service/LedgerBalance';
import { Database } from '@shared/infra/db/Database';

const INCLUDE = { account: { select: { name: true } } };

@Injectable()
export class FinanceInvoicePaymentDatasource implements IFinanceInvoicePaymentDatasource {
  constructor(private readonly db: Database) {}

  async exists(params: { owner: 'FAMILY' | 'USER'; owner_id: string }): Promise<boolean> {
    const found = await this.db.client.financialInvoicePayment.findFirst({
      select: { id: true },
      where: { owner: params.owner, owner_id: params.owner_id },
    });

    return found !== null;
  }

  async findByCardAndMonth(
    creditCardId: string,
    invoiceMonth: string,
  ): Promise<FinancialInvoicePaymentWithAccount | null> {
    return this.db.client.financialInvoicePayment.findFirst({
      include: INCLUDE,
      where: { credit_card_id: creditCardId, invoice_month: invoiceMonth },
    });
  }

  async findByCardIds(creditCardIds: string[]): Promise<FinancialInvoicePaymentWithAccount[]> {
    if (creditCardIds.length === 0) {
      return [];
    }

    return this.db.client.financialInvoicePayment.findMany({
      include: INCLUDE,
      where: { credit_card_id: { in: creditCardIds } },
    });
  }

  // The card row is locked first (the same order as a purchase write), then the invoice is re-summed
  // INSIDE the lock: a purchase that slipped in after the caller read the amount makes this a 409.
  async pay(params: PayInvoiceDatasourceParams): Promise<FinancialInvoicePaymentWithAccount> {
    return this.db.client.$transaction(async (tx) => {
      await lockCards(tx, [params.credit_card_id]);

      const existing = await tx.financialInvoicePayment.findFirst({
        select: { id: true },
        where: { credit_card_id: params.credit_card_id, invoice_month: params.invoice_month },
      });

      if (existing) {
        throw new ConflictException('Invoice already paid');
      }

      const sum = await tx.financialTransaction.aggregate({
        _sum: { value: true },
        where: { credit_card_id: params.credit_card_id, invoice_month: params.invoice_month },
      });

      if ((sum._sum.value ?? 0) !== params.amount) {
        throw new ConflictException('Invoice changed, reload and try again');
      }

      let transactionId: string | undefined;

      if (params.method === InvoicePaymentMethod.ACCOUNT) {
        const created = await tx.financialTransaction.create({
          data: {
            account_id: params.account_id,
            category_id: params.category_id,
            date: params.paid_on,
            description: params.description,
            owner: params.account_owner as Prisma.FinancialTransactionUncheckedCreateInput['owner'],
            owner_id: params.account_owner_id as string,
            paid: true,
            type: TransactionType.EXPENSE,
            value: params.amount,
          },
        });

        await applyLedgerDeltas(tx, ledgerDeltas(undefined, toLedgerEntry(created)));
        transactionId = created.id;
      }

      return tx.financialInvoicePayment.create({
        data: {
          account_id: params.account_id,
          amount: params.amount,
          credit_card_id: params.credit_card_id,
          invoice_month: params.invoice_month,
          method: params.method,
          owner: params.owner,
          owner_id: params.owner_id,
          paid_on: params.paid_on,
          transaction_id: transactionId,
        },
        include: INCLUDE,
      });
    });
  }

  async undo(creditCardId: string, invoiceMonth: string): Promise<void> {
    await this.db.client.$transaction(async (tx) => {
      await lockCards(tx, [creditCardId]);

      const payment = await tx.financialInvoicePayment.findFirst({
        where: { credit_card_id: creditCardId, invoice_month: invoiceMonth },
      });

      if (!payment) {
        throw new NotFoundException();
      }

      // The payment points at the transaction, so it goes first.
      await tx.financialInvoicePayment.deleteMany({ where: { id: payment.id } });

      if (payment.transaction_id) {
        const stored = await lockTransactionRow(tx, payment.transaction_id);

        await tx.financialTransaction.deleteMany({ where: { id: payment.transaction_id } });

        if (stored) {
          await applyLedgerDeltas(tx, ledgerDeltas(stored, undefined));
        }
      }
    });
  }
}
