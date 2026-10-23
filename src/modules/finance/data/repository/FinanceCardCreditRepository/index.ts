import { Inject, Injectable } from '@nestjs/common';

import { fromCalendarDate } from '@finance/data/datasource/mapper/CalendarDate';
import { FinanceTransactionMapper } from '@finance/data/datasource/mapper/FinanceTransactionMapper';
import { IFinanceCardCreditDatasource } from '@finance/data/repository/datasource/IFinanceCardCreditDatasource';
import { toCreateParams } from '@finance/data/repository/FinanceTransactionRepository';
import TransactionEntity from '@finance/domain/entity/TransactionEntity';
import {
  CardCreditAccount,
  CreateEarlyPaymentRepositoryParams,
  CreateImportRowsRepositoryParams,
  CreateRefundRepositoryParams,
  IFinanceCardCreditRepository,
  UpdateEarlyPaymentRepositoryParams,
  UpdateRefundRepositoryParams,
} from '@finance/domain/repository';

@Injectable()
export class FinanceCardCreditRepository implements IFinanceCardCreditRepository {
  constructor(
    @Inject('IFinanceCardCreditDatasource')
    private readonly cardCreditDatasource: IFinanceCardCreditDatasource,
  ) {}

  async countRefundsByPlanId(planId: string): Promise<number> {
    return this.cardCreditDatasource.countRefundsByPlanId(planId);
  }

  async countRefundsByTransactionId(transactionId: string): Promise<number> {
    return this.cardCreditDatasource.countRefundsByTransactionId(transactionId);
  }

  async createEarlyPayment(params: CreateEarlyPaymentRepositoryParams): Promise<TransactionEntity> {
    const result = await this.cardCreditDatasource.createEarlyPayment({
      account: toAccount(params.account),
      account_category_id: params.accountCategoryId,
      account_description: params.accountDescription,
      category_id: params.categoryId,
      credit_card_id: params.creditCardId,
      currency: params.currency,
      date: fromCalendarDate(params.date),
      description: params.description,
      expected_net: params.expectedNet,
      invoice_month: params.invoiceMonth,
      method: params.method,
      owner: params.owner,
      owner_id: params.ownerId,
      value: params.value,
    });

    return FinanceTransactionMapper.toDomain(result);
  }

  async createImportRows(params: CreateImportRowsRepositoryParams): Promise<number> {
    return this.cardCreditDatasource.createImportRows({
      earlyPayments: params.earlyPayments.map((early) => ({
        account: toAccount(early.account),
        account_category_id: early.accountCategoryId,
        account_description: early.accountDescription,
        category_id: early.categoryId,
        credit_card_id: early.creditCardId,
        currency: early.currency,
        date: fromCalendarDate(early.date),
        description: early.description,
        expected_net: early.expectedNet,
        invoice_month: early.invoiceMonth,
        method: early.method,
        owner: early.owner,
        owner_id: early.ownerId,
        value: early.value,
      })),
      payments: params.payments.map((payment) => ({
        account_id: payment.accountId,
        account_owner: payment.accountOwner?.owner,
        account_owner_id: payment.accountOwner?.ownerId,
        amount: payment.amount,
        category_id: payment.categoryId,
        credit_card_id: payment.creditCardId,
        currency: payment.currency,
        description: payment.description,
        invoice_month: payment.invoiceMonth,
        method: payment.method,
        owner: payment.owner,
        owner_id: payment.ownerId,
        paid_on: fromCalendarDate(payment.paidOn),
      })),
      purchases: params.purchases.map((row) => toCreateParams(row)),
      refunds: params.refunds.map((refund) => ({
        category_id: refund.categoryId,
        credit_card_id: refund.creditCardId,
        currency: refund.currency,
        date: fromCalendarDate(refund.date),
        description: refund.description,
        invoice_month: refund.invoiceMonth,
        owner: refund.owner,
        owner_id: refund.ownerId,
        value: refund.value,
      })),
    });
  }

  async createRefund(params: CreateRefundRepositoryParams): Promise<TransactionEntity> {
    const result = await this.cardCreditDatasource.createRefund({
      category_id: params.categoryId,
      credit_card_id: params.creditCardId,
      currency: params.currency,
      date: fromCalendarDate(params.date),
      description: params.description,
      invoice_month: params.invoiceMonth,
      max_linked: params.maxLinked,
      owner: params.owner,
      owner_id: params.ownerId,
      refunded_plan_id: params.refundedPlanId,
      refunded_transaction_id: params.refundedTransactionId,
      value: params.value,
    });

    return FinanceTransactionMapper.toDomain(result);
  }

  async deleteCredit(id: string): Promise<void> {
    await this.cardCreditDatasource.deleteCredit(id);
  }

  async updateEarlyPayment(params: UpdateEarlyPaymentRepositoryParams): Promise<TransactionEntity> {
    const result = await this.cardCreditDatasource.updateEarlyPayment({
      account: toAccount(params.account),
      account_description: params.accountDescription,
      date: params.date === undefined ? undefined : fromCalendarDate(params.date),
      description: params.description,
      expected_net: params.expectedNet,
      id: params.id,
      invoice_month: params.invoiceMonth,
      method: params.method,
      value: params.value,
    });

    return FinanceTransactionMapper.toDomain(result);
  }

  async updateRefund(params: UpdateRefundRepositoryParams): Promise<TransactionEntity> {
    const result = await this.cardCreditDatasource.updateRefund({
      date: params.date === undefined ? undefined : fromCalendarDate(params.date),
      description: params.description,
      id: params.id,
      invoice_month: params.invoiceMonth,
      max_linked: params.maxLinked,
      refunded_plan_id: params.refundedPlanId,
      refunded_transaction_id: params.refundedTransactionId,
      value: params.value,
    });

    return FinanceTransactionMapper.toDomain(result);
  }
}

function toAccount(account?: CardCreditAccount) {
  return account ? { id: account.id, owner: account.owner, owner_id: account.ownerId } : undefined;
}
